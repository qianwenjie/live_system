#import <Cocoa/Cocoa.h>
#include <node.h>

// 把所有 NSScreenSaverWindowLevel 以下的 Electron 透明窗口提升层级
// 通过匹配窗口尺寸和位置来找到目标窗口
void SetOverlayLevel(const v8::FunctionCallbackInfo<v8::Value>& args) {
  v8::Isolate* isolate = args.GetIsolate();
  if (args.Length() < 4 || !args[0]->IsNumber()) {
    isolate->ThrowException(v8::Exception::TypeError(
      v8::String::NewFromUtf8(isolate, "x, y, w, h required").ToLocalChecked()));
    return;
  }

  auto ctx = isolate->GetCurrentContext();
  int tx = (int)args[0]->NumberValue(ctx).FromJust();
  int ty = (int)args[1]->NumberValue(ctx).FromJust();
  int tw = (int)args[2]->NumberValue(ctx).FromJust();
  int th = (int)args[3]->NumberValue(ctx).FromJust();

  dispatch_async(dispatch_get_main_queue(), ^{
    for (NSWindow* win in [NSApp windows]) {
      NSRect f = [win frame];
      // macOS 坐标系 y 轴翻转：屏幕高度 - y - height
      NSScreen* mainScreen = [NSScreen mainScreen];
      CGFloat screenH = mainScreen.frame.size.height;
      int wy = (int)(screenH - f.origin.y - f.size.height);
      int wx = (int)f.origin.x;
      int ww = (int)f.size.width;
      int wh = (int)f.size.height;

      if (abs(wx - tx) <= 2 && abs(wy - ty) <= 2 && abs(ww - tw) <= 2 && abs(wh - th) <= 2) {
        [win setLevel:NSScreenSaverWindowLevel];
        [win setCollectionBehavior:
          NSWindowCollectionBehaviorCanJoinAllSpaces |
          NSWindowCollectionBehaviorStationary |
          NSWindowCollectionBehaviorIgnoresCycle |
          NSWindowCollectionBehaviorFullScreenAuxiliary];
      }
    }
  });
}

NODE_MODULE_INIT() {
  NODE_SET_METHOD(exports, "setOverlayLevel", SetOverlayLevel);
}
