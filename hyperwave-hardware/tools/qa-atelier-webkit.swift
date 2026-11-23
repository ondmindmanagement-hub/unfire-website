// Hyperwave Atelier automated visual smoke for the native macOS WebKit engine.
// Reproducible without Safari's "Allow Remote Automation" setting.
// Run: swiftc -O -o /tmp/hyperwave-qa hyperwave-hardware/tools/qa-atelier-webkit.swift
//      python3 -m http.server 8176 &
//      /tmp/hyperwave-qa
// Optional: HW_QA_URL, HW_QA_OUTPUT. A WKWebView test is NOT full Safari or an iPhone device.
import AppKit
import WebKit
import Foundation

final class QAHyperwave: NSObject, WKNavigationDelegate {
    let variants: [(Int, Int)] = [(1440, 900), (390, 844)]
    var index = 0, passed = 0, polls = 0
    var window: NSWindow!
    var web: WKWebView!
    let out = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HW_QA_OUTPUT"] ?? "/tmp/hyperwave-webkit-qa")
    func begin() {
        NSApplication.shared.setActivationPolicy(.prohibited)
        try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.alphaValue = 0.01
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .nonPersistent()
        web = WKWebView(frame: window.contentView!.bounds, configuration: cfg)
        web.autoresizingMask = [.width, .height]
        web.navigationDelegate = self
        window.contentView = web
        window.orderFront(nil)
        next()
    }
    func next() {
        if index >= variants.count { print("WEBKIT_TOTAL \(passed)/\(variants.count)"); fflush(stdout); exit(passed == variants.count ? 0 : 2) }
        let (w, h) = variants[index]
        polls = 0
        window.setContentSize(NSSize(width: w, height: h))
        web.frame = NSRect(x: 0, y: 0, width: w, height: h)
        print("WEBKIT_NAV \(w)x\(h)"); fflush(stdout)
        let url = ProcessInfo.processInfo.environment["HW_QA_URL"] ?? "http://127.0.0.1:8176/hyperwave-hardware/?embed=1"
        web.load(URLRequest(url: URL(string: url)!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 45))
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { poll() }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        print("WEBKIT_NAV_ERROR \(error.localizedDescription)"); fflush(stdout); index += 1; next()
    }
    let metricsJS = """
    (() => {
      const frame = document.getElementById('studio-frame');
      const hw = frame?.contentWindow?.__hw;
      if (!hw || !document.querySelector('.studio.live')) return JSON.stringify({ready:false});
      const T = frame.contentWindow.THREE, cam=hw.S.camera, controls=hw.S.controls;
      const bounds = new T.Box3();
      hw.H.root.updateMatrixWorld(true);
      hw.H.root.traverse(o=>{if(o.isMesh && o.visible && !o.userData.noGround)bounds.expandByObject(o)});
      let pts=[];
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) pts.push(new T.Vector3(x,y,z).project(cam));
      const r=document.querySelector('.studio').getBoundingClientRect();
      return JSON.stringify({ready:true,T:hw.st.T,target:hw.st.target,canvas:[r.width,r.height],
         left:Math.min(...pts.map(p=>p.x)),right:Math.max(...pts.map(p=>p.x)),top:Math.max(...pts.map(p=>p.y)),
         bottom:Math.min(...pts.map(p=>p.y)),mobileWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,
         auto:hw.view.auto,hasFit:!!document.getElementById('studio-fit')});
    })()
    """
    func poll() {
        let id = index
        web.evaluateJavaScript(metricsJS) { [weak self] val, err in
            guard let self = self, id == self.index else { return }
            if let s=val as? String, let data=s.data(using:.utf8),
                let obj=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],
                obj["ready"] as? Bool == true {
                print("WEBKIT_READY index=\(id) target=\(obj["target"] ?? "?")")
                fflush(stdout)
                DispatchQueue.main.asyncAfter(deadline: .now()+5.0) { self.finishMetrics(id) }
                return
            }
            self.polls+=1
            if self.polls>40 {
                print("WEBKIT_TIMEOUT index=\(id) err=\(err?.localizedDescription ?? "not ready")")
                fflush(stdout)
                self.index+=1;self.next()
                return
            }
            DispatchQueue.main.asyncAfter(deadline:.now()+0.5) { self.poll() }
        }
    }
    func finishMetrics(_ id:Int) {
        guard id==index else{return}
        web.evaluateJavaScript(metricsJS) { [weak self] val, err in
            guard let self=self, id==self.index else{return}
            let (w,h)=self.variants[id]
            guard let s=val as? String, let data=s.data(using:.utf8),
                let obj=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any] else {
                print("WEBKIT_METRIC_ERROR \(err?.localizedDescription ?? "?")");fflush(stdout);self.index+=1;self.next();return
            }
            let T=obj["T"] as? Double ?? -1, L=obj["left"] as? Double ?? -9,
                R=obj["right"] as? Double ?? 9, top=obj["top"] as? Double ?? 9,
                bottom=obj["bottom"] as? Double ?? -9, doc=obj["scrollWidth"] as? Int ?? -1
            let okay=T>3.85 && L >= -1 && R <= 1 && top <= 1 && bottom >= -1 && doc <= w && (obj["hasFit"] as? Bool ?? false)
            print("WEBKIT_METRIC \(w)x\(h) T=\(String(format:"%.2f",T)) bbox=[\(String(format:"%.2f",L)),\(String(format:"%.2f",R)),\(String(format:"%.2f",bottom)),\(String(format:"%.2f",top))] scrollWidth=\(doc) pass=\(okay)")
            fflush(stdout)
            if okay {self.passed+=1}
            let config=WKSnapshotConfiguration()
            config.rect=CGRect(x:0,y:0,width:w,height:h)
            self.web.takeSnapshot(with:config) { img,error in
                if let im=img, let tiff=im.tiffRepresentation,let bitmap=NSBitmapImageRep(data:tiff),
                    let png=bitmap.representation(using:.png,properties:[:]) {
                    try? png.write(to:self.out.appendingPathComponent("webkit_hyperwave_\(w).png"))
                } else {print("WEBKIT_SNAPSHOT_WARN \(error?.localizedDescription ?? "")")}
                self.index+=1;self.next()
            }
        }
    }
}
let app=NSApplication.shared
let qa=QAHyperwave()
qa.begin()
app.run()
