import SwiftUI
import ReviewBindingCore

struct ReviewScreen: View {
    @State private var session: ReviewAcknowledgement?
    @State private var notice="This is an unsigned, local demonstration. No real authorization."
    @State private var nowIssued=Date()

    init() {
        let now=Int64(Date().timeIntervalSince1970*1000)
        if let item=try? LocalDemo.make(nowMs:now),
           let review=try? ReviewAcknowledgement(request:item,nowMs:now) {
            _session=State(initialValue:review)
        } else {
            _session=State(initialValue:nil)
        }
    }

    private var active:Bool { session?.phase == .pending }

    private func field(_ name:String,_ value:String) -> some View {
        VStack(alignment:.leading,spacing:6) {
            Text(name).font(.system(size:10,weight:.semibold))
                .tracking(1.6).foregroundStyle(.white.opacity(0.48))
            Text(value).font(.system(size:13)).foregroundStyle(.white.opacity(0.94))
                .fixedSize(horizontal:false,vertical:true)
                .textSelection(.enabled)
        }.frame(maxWidth:.infinity,alignment:.leading)
    }

    var body:some View {
        ZStack {
            Color(red:0.054,green:0.066,blue:0.085).ignoresSafeArea()
            ScrollView {
                VStack(alignment:.leading,spacing:23) {
                    HStack {
                        Image(systemName:"checkmark.shield.fill")
                            .foregroundStyle(Color(red:0.48,green:0.82,blue:0.71))
                        Text("UNFIRE").tracking(3).font(.system(size:13,weight:.bold))
                        Spacer()
                        Text("LOCAL MOCK").tracking(1.3)
                            .font(.system(size:10,weight:.semibold))
                            .foregroundStyle(.white.opacity(0.52))
                    }
                    Text("See exactly what you confirm.")
                        .font(.system(size:32,weight:.semibold))
                        .tracking(-1.1)
                    Text("The displayed details must match the immutable P-256 request. A mismatch blocks review. This screen does not grant a permission.")
                        .font(.system(size:13))
                        .foregroundStyle(.white.opacity(0.67))
                        .fixedSize(horizontal:false,vertical:true)

                    if let item=session?.request {
                        VStack(alignment:.leading,spacing:15) {
                            field("OPERATION",item.manifest.operation)
                            Divider().overlay(.white.opacity(0.10))
                            field("TARGET","Public arithmetic fixture · Local only")
                            Divider().overlay(.white.opacity(0.10))
                            field("REQUEST",item.manifest.description)
                            Divider().overlay(.white.opacity(0.10))
                            field("EFFECT",item.manifest.effect)
                            Divider().overlay(.white.opacity(0.10))
                            field("EXPIRES",Date(timeIntervalSince1970:
                                Double(item.challenge.expiresAtMs)/1000)
                                .formatted(date:.abbreviated,time:.standard))
                            Divider().overlay(.white.opacity(0.10))
                            field("REQUEST DIGEST",item.challenge.proposalDigest)
                            field("CHALLENGE FINGERPRINT",item.challengeFingerprint)
                        }
                        .padding(20)
                        .background(RoundedRectangle(cornerRadius:18)
                            .fill(.white.opacity(0.06)))
                        .overlay(RoundedRectangle(cornerRadius:18)
                            .strokeBorder(.white.opacity(0.08)))
                    } else {
                        Text("No valid synthetic challenge is available.")
                            .foregroundStyle(.orange)
                    }

                    HStack(alignment:.top,spacing:9) {
                        Image(systemName:"lock.shield")
                            .foregroundStyle(Color.orange)
                        Text("No device authentication · No Secure Enclave signing · No external actions")
                            .font(.system(size:12,weight:.medium))
                            .foregroundStyle(.white.opacity(0.83))
                    }
                    Text(notice)
                        .font(.system(size:12))
                        .foregroundStyle(.white.opacity(0.6))
                        .fixedSize(horizontal:false,vertical:true)

                    HStack(spacing:12) {
                        Button {
                            guard var review=session else{return}
                            do {
                                try review.acknowledgeAfterClick(
                                    nowMs:Int64(Date().timeIntervalSince1970*1000)
                                )
                                notice="You acknowledged the local preview. No approval was signed."
                            } catch {
                                notice="Review denied or expired. No action occurred."
                            }
                            session=review
                        } label: {
                            Text("Confirm preview")
                                .frame(maxWidth:.infinity,minHeight:38)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(red:0.40,green:0.76,blue:0.65))
                        .disabled(!active)

                        Button("Deny") {
                            guard var review=session else{return}
                            review.deny();session=review
                            notice="Denied. No action occurred."
                        }
                        .buttonStyle(.bordered).disabled(!active)

                        Button("STOP") {
                            guard var review=session else{return}
                            review.stop();session=review
                            notice="Stopped. All local preview interaction is disabled."
                        }
                        .buttonStyle(.bordered).tint(.red)
                    }

                    Text("Status · " + {
                        switch session?.phase {
                        case .pending: return "Awaiting review"
                        case .acknowledged: return "Preview acknowledged only"
                        case .denied: return "Denied"
                        case .stopped: return "Stopped"
                        case .expired: return "Expired"
                        case nil: return "Unavailable"
                        }
                    }())
                    .font(.system(size:11,weight:.medium))
                    .foregroundStyle(.white.opacity(0.6))
                }
                .frame(maxWidth:620)
                .padding(34)
                .frame(maxWidth:.infinity)
            }
        }
        .frame(minWidth:640,minHeight:760)
        .preferredColorScheme(.dark)
    }
}

@main
struct UnfireReviewBindingApp: App {
    var body:some Scene {
        WindowGroup("Unfire · Exact Review") {
            ReviewScreen()
        }
        .windowResizability(.contentSize)
    }
}
