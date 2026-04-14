{
  "targets": [{
    "target_name": "overlay",
    "sources": ["overlay.mm"],
    "include_dirs": [
      "<!@(node -e \"require('nan'); process.stdout.write(require('path').dirname(require.resolve('nan')))\")"
    ],
    "libraries": ["-framework Cocoa"],
    "xcode_settings": {
      "OTHER_CPLUSPLUSFLAGS": ["-std=c++20", "-stdlib=libc++"],
      "MACOSX_DEPLOYMENT_TARGET": "11.0"
    },
    "conditions": [
      ["OS=='mac'", {
        "sources": ["overlay.mm"]
      }]
    ]
  }]
}
