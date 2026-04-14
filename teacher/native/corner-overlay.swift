import Cocoa
import ScreenCaptureKit

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
    showWindowBorders(getRectsForWindows(windowIds))
    // 设为 normal 级别，让边框跟随窗口 z 轴
    overlayWin?.level = .normal

    Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
        showWindowBorders(getRectsForWindows(windowIds))
        // 把边框始终保持在目标窗口正上方
        if let overlay = overlayWin, let topWid = windowIds.first {
            overlay.order(.above, relativeTo: Int(topWid))
        }
    }
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

    if mode == "icon", args.count >= 3 {
        // 通过 windowId 获取 app icon，输出 base64 PNG
        let wid = CGWindowID(UInt32(args[2]) ?? 0)
        let list = CGWindowListCopyWindowInfo([.optionIncludingWindow], wid) as? [[String: Any]]
        if let pid = list?.first?[kCGWindowOwnerPID as String] as? pid_t,
           let runApp = NSRunningApplication(processIdentifier: pid),
           let icon = runApp.icon {
            let size = NSSize(width: 64, height: 64)
            let img = NSImage(size: size)
            img.lockFocus()
            icon.draw(in: NSRect(origin: .zero, size: size))
            img.unlockFocus()
            if let tiff = img.tiffRepresentation,
               let bmp = NSBitmapImageRep(data: tiff),
               let png = bmp.representation(using: .png, properties: [:]) {
                print(png.base64EncodedString())
            }
        }
        exit(0)
    } else if mode == "list-windows" {
        // 只返回屏幕上可见的用户窗口，每个应用只取一个主窗口，JSON 格式
        let regularPIDs: Set<pid_t> = Set(
            NSWorkspace.shared.runningApplications
                .filter { $0.activationPolicy == .regular }
                .map { $0.processIdentifier }
        )
        let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []

        // 按 owner 分组，每组选最佳主窗口
        var ownerBest: [String: (wid: Int, name: String, score: Int, pid: pid_t)] = [:]
        for w in list {
            guard let layer = w[kCGWindowLayer as String] as? Int, layer == 0 else { continue }
            guard let wid = w[kCGWindowNumber as String] as? Int else { continue }
            guard let pid = w[kCGWindowOwnerPID as String] as? pid_t else { continue }
            guard regularPIDs.contains(pid) else { continue }
            guard let bounds = w[kCGWindowBounds as String] as? [String: CGFloat],
                  let bw = bounds["Width"], let bh = bounds["Height"],
                  bw > 50 && bh > 50 else { continue }  // 过滤极小窗口
            let owner = w[kCGWindowOwnerName as String] as? String ?? ""
            guard !owner.isEmpty else { continue }
            let rawName = w[kCGWindowName as String] as? String ?? ""
            // 评分：name==owner 得3分，name包含owner得2分，name非空得1分，否则0分
            let score: Int
            if rawName == owner { score = 3 }
            else if rawName.contains(owner) || owner.contains(rawName) && !rawName.isEmpty { score = 2 }
            else if !rawName.isEmpty { score = 1 }
            else { score = 0 }
            if let best = ownerBest[owner] {
                if score > best.score { ownerBest[owner] = (wid, rawName, score, pid) }
            } else {
                ownerBest[owner] = (wid, rawName, score, pid)
            }
        }

        var items: [String] = []
        for (owner, best) in ownerBest {
            let displayName = (best.name.isEmpty || best.score == 1) ? owner : best.name
            let escaped = displayName.replacingOccurrences(of: "\"", with: "\\\"")
            let escapedOwner = owner.replacingOccurrences(of: "\"", with: "\\\"")
            // 获取 app icon
            var iconB64 = ""
            if let runApp = NSRunningApplication(processIdentifier: best.pid), let icon = runApp.icon {
                let sz = NSSize(width: 64, height: 64)
                let img = NSImage(size: sz); img.lockFocus()
                icon.draw(in: NSRect(origin: .zero, size: sz)); img.unlockFocus()
                if let t = img.tiffRepresentation, let b = NSBitmapImageRep(data: t),
                   let p = b.representation(using: .png, properties: [:]) { iconB64 = p.base64EncodedString() }
            }
            items.append("{\"windowId\":\(best.wid),\"name\":\"\(escaped)\",\"owner\":\"\(escapedOwner)\",\"icon\":\"\(iconB64)\"}")
        }
        print("[" + items.joined(separator: ",") + "]")
        exit(0)
    } else if mode == "capture-windows", args.count >= 3 {
        // 批量截图多个窗口，一次 SCK 查询，并发截图，输出 JSON: {"wid":"base64",...}
        let wids = args.dropFirst(2).compactMap { UInt32($0) }.map { CGWindowID($0) }
        var results: [String: String] = [:]
        let lock = DispatchQueue(label: "capture-lock")
        var done = false

        if #available(macOS 12.3, *) {
            SCShareableContent.getWithCompletionHandler { content, _ in
                guard let content = content else { done = true; return }
                let group = DispatchGroup()
                for wid in wids {
                    guard let scWin = content.windows.first(where: { $0.windowID == wid }) else { continue }
                    group.enter()
                    let filter = SCContentFilter(desktopIndependentWindow: scWin)
                    let cfg = SCStreamConfiguration()
                    cfg.width = min(400, max(1, Int(scWin.frame.width)))
                    cfg.height = min(300, max(1, Int(scWin.frame.height)))
                    cfg.showsCursor = false
                    SCScreenshotManager.captureImage(contentFilter: filter, configuration: cfg) { img, _ in
                        if let img = img {
                            let bmp = NSBitmapImageRep(cgImage: img)
                            if let png = bmp.representation(using: .png, properties: [:]) {
                                lock.sync { results[String(wid)] = png.base64EncodedString() }
                            }
                        }
                        group.leave()
                    }
                }
                group.notify(queue: .main) { done = true }
            }
            while !done {
                RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05))
            }
        }
        // 输出 JSON
        var items: [String] = []
        for (k, v) in results { items.append("\"\(k)\":\"\(v)\"") }
        print("{" + items.joined(separator: ",") + "}")
        exit(0)
    } else if mode == "activate" {
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
