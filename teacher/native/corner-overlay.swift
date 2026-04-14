import Cocoa

let GREEN = NSColor(red: 0.133, green: 0.773, blue: 0.369, alpha: 1)

// MARK: - 全屏覆盖层（应用窗口模式）

class OverlayView: NSView {
    var rects: [(CGFloat, CGFloat, CGFloat, CGFloat)] = [] {
        didSet { needsDisplay = true }
    }
    override func draw(_ dirtyRect: NSRect) {
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }
        ctx.clear(bounds)
        guard !rects.isEmpty else { return }

        let screenH = NSScreen.main!.frame.height
        let lw: CGFloat = 6

        if #available(macOS 13.0, *) {
            // macOS 13+：用 CGPath.union 做真正的布尔并集
            var unionPath: CGPath = CGPath(rect: .zero, transform: nil)
            var first = true
            for (x, y, w, h) in rects {
                let nsY = screenH - y - h
                let p = CGPath(rect: CGRect(x: x, y: nsY, width: w, height: h), transform: nil)
                if first { unionPath = p; first = false }
                else { unionPath = unionPath.union(p) }
            }
            ctx.setStrokeColor(GREEN.cgColor)
            ctx.setLineWidth(lw)
            ctx.setLineJoin(.miter)
            ctx.addPath(unionPath)
            ctx.strokePath()
        } else {
            // 降级：每个矩形独立描边
            ctx.setStrokeColor(GREEN.cgColor)
            ctx.setLineWidth(lw)
            for (x, y, w, h) in rects {
                let nsY = screenH - y - h
                ctx.stroke(CGRect(x: x, y: nsY, width: w, height: h))
            }
        }
    }
}

var overlayWin: NSPanel?
var overlayView: OverlayView?

func setupOverlay() {
    guard overlayWin == nil else { return }
    let screen = NSScreen.main!.frame
    let win = NSPanel(
        contentRect: screen,
        styleMask: [.borderless, .nonactivatingPanel],
        backing: .buffered, defer: false
    )
    win.backgroundColor = .clear
    win.isOpaque = false
    win.hasShadow = false
    win.ignoresMouseEvents = true
    win.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenAuxiliary]
    win.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.overlayWindow)))
    let view = OverlayView(frame: screen)
    view.wantsLayer = true
    view.layer?.backgroundColor = CGColor.clear
    win.contentView = view
    win.orderFrontRegardless()
    overlayWin = win
    overlayView = view
}

func showWindowBorders(_ rects: [(CGFloat, CGFloat, CGFloat, CGFloat)]) {
    setupOverlay()
    overlayView?.rects = rects
}

// MARK: - 矩形合并（相交时合并，分离时独立）

func rectsOverlap(_ a: (CGFloat,CGFloat,CGFloat,CGFloat), _ b: (CGFloat,CGFloat,CGFloat,CGFloat), gap: CGFloat = 2) -> Bool {
    return a.0 < b.0+b.2+gap && a.0+a.2+gap > b.0 && a.1 < b.1+b.3+gap && a.1+a.3+gap > b.1
}

func mergeRects(_ input: [(CGFloat,CGFloat,CGFloat,CGFloat)]) -> [(CGFloat,CGFloat,CGFloat,CGFloat)] {
    var rects = input
    var changed = true
    while changed {
        changed = false
        var result: [(CGFloat,CGFloat,CGFloat,CGFloat)] = []
        var used = Array(repeating: false, count: rects.count)
        for i in 0..<rects.count {
            if used[i] { continue }
            var (x1, y1, x2, y2) = (rects[i].0, rects[i].1, rects[i].0+rects[i].2, rects[i].1+rects[i].3)
            for j in (i+1)..<rects.count {
                if used[j] { continue }
                if rectsOverlap(rects[i], rects[j]) {
                    x1 = min(x1, rects[j].0); y1 = min(y1, rects[j].1)
                    x2 = max(x2, rects[j].0+rects[j].2); y2 = max(y2, rects[j].1+rects[j].3)
                    used[j] = true; changed = true
                }
            }
            result.append((x1, y1, x2-x1, y2-y1))
        }
        rects = result
    }
    return rects
}

func getRectsForWindows(_ windowIds: [CGWindowID]) -> [(CGFloat,CGFloat,CGFloat,CGFloat)] {
    var rects: [(CGFloat,CGFloat,CGFloat,CGFloat)] = []
    for wid in windowIds {
        let list = CGWindowListCopyWindowInfo([.optionIncludingWindow], wid) as? [[String: Any]]
        if let info = list?.first,
           let bd = info[kCGWindowBounds as String] as? [String: CGFloat],
           let wx = bd["X"], let wy = bd["Y"], let ww = bd["Width"], let wh = bd["Height"] {
            rects.append((wx, wy, ww, wh))
        }
    }
    // 不合并：保留每个窗口独立矩形，由 OverlayView 用 even-odd 画并集轮廓
    return rects
}

func startTracking(_ windowIds: [CGWindowID]) {
    func update() { showWindowBorders(getRectsForWindows(windowIds)) }
    update()
    Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in update() }
}

// MARK: - 角框（桌面模式）

class CornerView: NSView {
    var corner: String = "tl"
    override func draw(_ dirtyRect: NSRect) {
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }
        let w = bounds.width, h = bounds.height
        let L: CGFloat = 120, lw: CGFloat = 6, p: CGFloat = lw / 2
        ctx.setStrokeColor(GREEN.cgColor)
        ctx.setLineWidth(lw)
        ctx.setLineCap(.square)
        switch corner {
        case "tl": ctx.move(to: CGPoint(x: p, y: h-p-L)); ctx.addLine(to: CGPoint(x: p, y: h-p)); ctx.addLine(to: CGPoint(x: p+L, y: h-p))
        case "tr": ctx.move(to: CGPoint(x: w-p-L, y: h-p)); ctx.addLine(to: CGPoint(x: w-p, y: h-p)); ctx.addLine(to: CGPoint(x: w-p, y: h-p-L))
        case "bl": ctx.move(to: CGPoint(x: p, y: p+L)); ctx.addLine(to: CGPoint(x: p, y: p)); ctx.addLine(to: CGPoint(x: p+L, y: p))
        case "br": ctx.move(to: CGPoint(x: w-p-L, y: p)); ctx.addLine(to: CGPoint(x: w-p, y: p)); ctx.addLine(to: CGPoint(x: w-p, y: p+L))
        default: break
        }
        ctx.strokePath()
    }
}

func makeCornerPanel(corner: String, x: CGFloat, y: CGFloat, size: CGFloat) -> NSPanel {
    let screenH = NSScreen.main!.frame.height
    let nsY = screenH - y - size
    let p = NSPanel(
        contentRect: NSRect(x: x, y: nsY, width: size, height: size),
        styleMask: [.borderless, .nonactivatingPanel],
        backing: .buffered, defer: false
    )
    p.backgroundColor = .clear; p.isOpaque = false; p.hasShadow = false
    p.ignoresMouseEvents = true
    p.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenAuxiliary]
    p.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.overlayWindow)))
    let v = CornerView(frame: NSRect(x: 0, y: 0, width: size, height: size))
    v.corner = corner; v.wantsLayer = true; v.layer?.backgroundColor = CGColor.clear
    p.contentView = v
    p.orderFrontRegardless()
    return p
}

func showScreenCorners(x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat) {
    let S: CGFloat = 140
    _ = makeCornerPanel(corner: "tl", x: x,     y: y,     size: S)
    _ = makeCornerPanel(corner: "tr", x: x+w-S, y: y,     size: S)
    _ = makeCornerPanel(corner: "bl", x: x,     y: y+h-S, size: S)
    _ = makeCornerPanel(corner: "br", x: x+w-S, y: y+h-S, size: S)
}

// MARK: - 激活窗口

func activateWindowsByIds(_ windowIds: [CGWindowID]) {
    var pids = Set<pid_t>()
    for wid in windowIds {
        let list = CGWindowListCopyWindowInfo([.optionIncludingWindow], wid) as? [[String: Any]]
        if let pid = list?.first?[kCGWindowOwnerPID as String] as? pid_t { pids.insert(pid) }
    }
    for pid in pids {
        if let app = NSRunningApplication(processIdentifier: pid) {
            if #available(macOS 14.0, *) { app.activate() }
            else { app.activate(options: [.activateIgnoringOtherApps]) }
        }
    }
}

// MARK: - main

func main() {
    let args = CommandLine.arguments
    guard args.count >= 2 else { exit(1) }
    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)
    let mode = args[1]

    if mode == "activate" {
        let ids = args.dropFirst(2).compactMap { UInt32($0) }.map { CGWindowID($0) }
        activateWindowsByIds(ids)
        exit(0)
    } else if mode == "screen" {
        let b = NSScreen.main!.frame
        showScreenCorners(x: b.origin.x, y: 0, w: b.width, h: b.height)
    } else if mode == "window", args.count >= 3 {
        let ids = args.dropFirst(2).compactMap { UInt32($0) }.map { CGWindowID($0) }
        startTracking(ids)
    } else {
        exit(1)
    }

    DispatchQueue.global().async { _ = readLine(); exit(0) }
    app.run()
}

main()
