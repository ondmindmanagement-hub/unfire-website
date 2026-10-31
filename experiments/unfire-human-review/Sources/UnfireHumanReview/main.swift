import SwiftUI
import LocalAuthentication

@MainActor
final class ReviewViewModel: ObservableObject {
    @Published private(set) var policy: ReviewPolicy
    @Published private(set) var statusMessage: String = "No device authentication has been requested."
    private var pendingContext: LAContext?

    init() {
        policy = ReviewPolicy(request: .synthetic(at: Date()))
    }

    var phase: ReviewPhase { policy.phase }
    var canConfirm: Bool { policy.phase == .pending }

    func confirmAfterUserClick() {
        guard let ticket = policy.beginAuthentication(now: Date()) else {
            statusMessage = "Review is no longer available. No action occurred."
            objectWillChange.send()
            return
        }
        // This authenticates the current macOS account only. It does NOT sign a
        // durable Ed25519 challenge or establish a production permission.
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            policy.completeAuthentication(ticket: ticket, granted: false, now: Date())
            statusMessage = "Device authentication unavailable. Review denied."
            objectWillChange.send()
            return
        }
        pendingContext = context
        statusMessage = "Waiting for macOS device authentication."
        objectWillChange.send()
        context.evaluatePolicy(
            .deviceOwnerAuthentication,
            localizedReason: "Confirm an Unfire synthetic preview. No external action will occur."
        ) { [weak self] granted, _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.pendingContext = nil
                self.policy.completeAuthentication(
                    ticket: ticket, granted: granted, now: Date()
                )
                self.statusMessage = self.policy.phase == .approvedPreview
                    ? "Device authentication succeeded. This is only a simulated preview."
                    : "Authentication denied, expired or cancelled. No action occurred."
                self.objectWillChange.send()
            }
        }
    }

    func deny() {
        pendingContext?.invalidate()
        pendingContext = nil
        policy.deny()
        statusMessage = "Review denied. No action occurred."
        objectWillChange.send()
    }

    func stop() {
        pendingContext?.invalidate()
        pendingContext = nil
        policy.stop()
        statusMessage = "STOP active for this demonstration. Nothing was executed."
        objectWillChange.send()
    }
}

struct ReviewContentView: View {
    @StateObject private var model = ReviewViewModel()

    private var request: ReviewRequest { model.policy.request }

    var body: some View {
        ZStack {
            Color(red: 0.055, green: 0.066, blue: 0.083).ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    HStack {
                        Image(systemName: "checkmark.shield.fill")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Color(red: 0.56, green: 0.86, blue: 0.77))
                        Text("UNFIRE")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .tracking(3.0)
                            .foregroundStyle(.white)
                        Spacer()
                        Text("RESEARCH PREVIEW")
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(1.1)
                            .foregroundStyle(.white.opacity(0.63))
                    }
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Review before approval.")
                            .font(.system(size: 34, weight: .semibold))
                            .tracking(-1.3)
                            .foregroundStyle(.white)
                        Text("A model proposal is not permission. Review its exact scope before requesting authentication from macOS.")
                            .font(.system(size: 13))
                            .foregroundStyle(.white.opacity(0.67))
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: 0) {
                        labelValue("REQUEST", request.id)
                        Divider().overlay(.white.opacity(0.1)).padding(.vertical, 15)
                        labelValue("OPERATION", request.operation)
                        Divider().overlay(.white.opacity(0.1)).padding(.vertical, 15)
                        labelValue("TARGET", request.target)
                        Divider().overlay(.white.opacity(0.1)).padding(.vertical, 15)
                        labelValue("DESCRIPTION", request.description)
                        Divider().overlay(.white.opacity(0.1)).padding(.vertical, 15)
                        labelValue("EFFECT", request.effect)
                        Divider().overlay(.white.opacity(0.1)).padding(.vertical, 15)
                        VStack(alignment: .leading, spacing: 7) {
                            Text("REQUEST FINGERPRINT")
                                .font(.system(size: 10, weight: .semibold))
                                .tracking(1.0)
                                .foregroundStyle(.white.opacity(0.48))
                            Text(request.fingerprint)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(.white.opacity(0.75))
                                .textSelection(.enabled)
                        }
                    }
                    .padding(22)
                    .background(
                        RoundedRectangle(cornerRadius: 19, style: .continuous)
                            .fill(Color.white.opacity(0.065))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 19, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.09), lineWidth: 1)
                    )

                    HStack(spacing: 9) {
                        Image(systemName: "lock.shield")
                            .foregroundStyle(Color(red: 0.99, green: 0.78, blue: 0.43))
                        Text("Preview only. No signing key, account access, installation, file edit, or external action.")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.white.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.horizontal, 3)

                    VStack(alignment: .leading, spacing: 9) {
                        Text(model.phase.rawValue)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(model.phase == .approvedPreview
                                ? Color(red: 0.56, green: 0.86, blue: 0.77) : .white)
                        Text(model.statusMessage)
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.65))
                            .fixedSize(horizontal: false, vertical: true)
                        Text("Signed authorization: Not implemented · Real actions: Disabled")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.white.opacity(0.5))
                    }

                    HStack(spacing: 12) {
                        Button(action: model.confirmAfterUserClick) {
                            Label("Confirm preview", systemImage: "touchid")
                                .font(.system(size: 13, weight: .semibold))
                                .frame(maxWidth: .infinity)
                                .frame(height: 39)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(red: 0.44, green: 0.78, blue: 0.67))
                        .disabled(!model.canConfirm)
                        .accessibilityHint("Requests macOS account authentication for this synthetic preview only.")

                        Button("Deny", action: model.deny)
                            .buttonStyle(.bordered)
                            .frame(width: 92)
                            .disabled(!model.canConfirm && model.phase != .authenticating)

                        Button("STOP", action: model.stop)
                            .buttonStyle(.bordered)
                            .tint(.red)
                            .frame(width: 82)
                    }
                }
                .frame(maxWidth: 650)
                .padding(36)
                .frame(maxWidth: .infinity)
            }
        }
        .frame(minWidth: 640, minHeight: 740)
        .preferredColorScheme(.dark)
    }

    private func labelValue(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.0)
                .foregroundStyle(.white.opacity(0.48))
            Text(value)
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.94))
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

@main
struct UnfireHumanReviewApp: App {
    var body: some Scene {
        WindowGroup("Unfire · Human Review") {
            ReviewContentView()
        }
        .windowResizability(.contentSize)
    }
}
