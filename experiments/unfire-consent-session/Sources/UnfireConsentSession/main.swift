import Foundation
import SwiftUI
import LocalAuthentication
import UnfireEnclaveGate
import ConsentSessionCore

@MainActor
final class ReviewModel: ObservableObject {
    @Published var status = "No signed synthetic request loaded."
    @Published var phase = "Unavailable"
    private(set) var session: SyntheticConsentSession?
    private var context: LAContext?
    private let signer = ProtectedP256SigningService()

    init() {
        // Only an explicitly launched local research session is accepted.
        // The host-supplied public-key pins are NOT a production trust anchor.
        let args = CommandLine.arguments
        guard args.count == 6,
              args[1] == "--interactive-research-only",
              let envelope = Data(base64Encoded: args[2]),
              let issuer = Data(base64Encoded: args[3]),
              let reviewer = Data(base64Encoded: args[4]),
              args[5].hasPrefix("/") else {
            status = "No eligible request. Research-only launch inputs required."
            return
        }
        do {
            session = try SyntheticConsentSession(
                envelopeData: envelope,
                pinnedIssuerPublicDER: issuer,
                pinnedReviewerPublicDER: reviewer,
                journalPath: args[5],
                nowMs: Self.now()
            )
            phase = "Signed test issuer verified · Awaiting review"
            status = "Exact fixed scope matches signed bytes. No key or authorization has been used."
        } catch {
            status = "Unverified or expired request. No action performed."
        }
    }
    static func now() -> Int64 {
        Int64(Date().timeIntervalSince1970 * 1000)
    }
    var canConfirm: Bool { session?.canConfirm ?? false }

    func confirm() {
        guard let session else { return }
        do {
            // Only a real button click reaches this path.
            let attempt = try session.beginAfterUserClick(nowMs: Self.now())
            phase = "Requesting protected research signature"
            status = "macOS may request the user's device credential."
            let ctx = try LAContext()
            context = ctx
            ctx.localizedCancelTitle = "Cancel"
            defer { ctx.invalidate(); context = nil }
            // No automatic enrollment, no software-key fallback.
            let signed = try signer.signAfterExplicitUserAction(
                challenge: session.review.challenge,
                context: ctx, explicitlyConfirmed: true, nowMs: Self.now()
            )
            try session.finish(ticket: attempt,
                publicKeyDER: signed.publicKeyDER,
                signatureDER: signed.signatureDER, nowMs: Self.now())
            phase = "Signed synthetic preview · No external action"
            status = "Signature checked locally. No production user consent or real tool permission claimed."
        } catch {
            session.deny(nowMs: Self.now())
            phase = "Denied / unavailable"
            status = "Signing failed or was cancelled. The request cannot be retried."
        }
    }
    func deny() {
        context?.invalidate(); context = nil
        session?.deny(nowMs: Self.now())
        phase = "Denied"
        status = "No action performed."
    }
    func stop() {
        context?.invalidate(); context = nil
        do {
            try session?.stop(nowMs: Self.now())
            phase = "STOP persisted"
            status = "Research journal STOP recorded. No external action."
        } catch {
            phase = "STOP locally"
            status = "No action. Persistent STOP could not be independently verified."
        }
    }
}

struct ReviewScreen: View {
    @StateObject private var model = ReviewModel()
    private let mint = Color(red:0.49,green:0.83,blue:0.73)
    private func detail(_ label:String,_ value:String) -> some View {
        VStack(alignment:.leading,spacing:6) {
            Text(label).font(.system(size:10,weight:.bold))
                .tracking(1.2).foregroundStyle(.white.opacity(0.48))
            Text(value).font(.system(size:13))
                .foregroundStyle(.white).textSelection(.enabled)
                .fixedSize(horizontal:false,vertical:true)
        }.frame(maxWidth:.infinity,alignment:.leading)
    }
    var body:some View {
        ZStack {
            Color(red:0.05,green:0.066,blue:0.085).ignoresSafeArea()
            ScrollView {
                VStack(alignment:.leading,spacing:24) {
                    HStack {
                        Label("UNFIRE",systemImage:"checkmark.shield.fill")
                            .foregroundStyle(mint)
                            .font(.system(size:13,weight:.bold))
                            .tracking(2.5)
                        Spacer()
                        Text("SYNTHETIC RESEARCH")
                            .font(.system(size:10,weight:.semibold))
                            .tracking(1).foregroundStyle(.white.opacity(0.5))
                    }
                    Text("Review the exact request.")
                        .font(.system(size:32,weight:.semibold))
                        .tracking(-1.2).foregroundStyle(.white)
                    Text("The signed controller message is verified against the fixed public scope before any protected signing attempt. No real actions are permitted.")
                        .font(.system(size:13))
                        .foregroundStyle(.white.opacity(0.68))
                        .fixedSize(horizontal:false,vertical:true)
                    if let request=model.session {
                        VStack(alignment:.leading,spacing:14) {
                            detail("OPERATION",request.review.manifest.operation)
                            Divider().overlay(.white.opacity(0.1))
                            detail("TARGET","Local public arithmetic fixture")
                            detail("REQUEST",request.review.manifest.description)
                            detail("EFFECT",request.review.manifest.effect)
                            detail("EXPIRES",Date(timeIntervalSince1970:
                                Double(request.envelope.expiresAtMs)/1000)
                                .formatted(date:.abbreviated,time:.standard))
                            detail("TEST ISSUER FINGERPRINT",request.envelope.issuerFingerprint)
                            detail("CHALLENGE FINGERPRINT",request.review.challengeFingerprint)
                        }
                        .padding(22)
                        .background(RoundedRectangle(cornerRadius:18)
                            .fill(.white.opacity(0.06)))
                    } else {
                        Text("No verified signed request.").foregroundStyle(.orange)
                    }
                    Label("No automatic key enrollment. Signing requires an independently pre-enrolled protected key.",systemImage:"lock.shield")
                        .font(.system(size:12,weight:.medium)).foregroundStyle(.orange)
                    Text(model.phase).font(.system(size:14,weight:.semibold))
                        .foregroundStyle(.white)
                    Text(model.status).font(.system(size:12))
                        .foregroundStyle(.white.opacity(0.68))
                        .fixedSize(horizontal:false,vertical:true)
                    HStack(spacing:12) {
                        Button(action:model.confirm) {
                            Label("Confirm & sign preview",systemImage:"touchid")
                                .frame(maxWidth:.infinity,minHeight:40)
                        }
                        .buttonStyle(.borderedProminent).tint(mint)
                        .disabled(!model.canConfirm)
                        Button("Deny",action:model.deny)
                            .buttonStyle(.bordered).disabled(!model.canConfirm)
                        Button("STOP",action:model.stop)
                            .buttonStyle(.bordered).tint(.red)
                            .disabled(model.session==nil)
                    }
                    Text("Local test only · No authenticated production controller · No app, file, email, payment or agent privileges")
                        .font(.system(size:11))
                        .foregroundStyle(.white.opacity(0.48))
                }
                .frame(maxWidth:640)
                .padding(36)
                .frame(maxWidth:.infinity)
            }
        }
        .frame(minWidth:660,minHeight:760)
        .preferredColorScheme(.dark)
    }
}

@main
struct ConsentResearchApp:App {
    var body:some Scene {
        WindowGroup("Unfire · Protected Review Research") {
            ReviewScreen()
        }.windowResizability(.contentSize)
    }
}
