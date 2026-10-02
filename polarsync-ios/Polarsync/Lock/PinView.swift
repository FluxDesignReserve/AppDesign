import PolarsyncCore
import SwiftUI

struct PinView: View {
    @Environment(LockModel.self) private var lock

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let lockedOut = lock.isLockedOut(at: context.date)
            VStack(spacing: 28) {
                Spacer()
                Image(systemName: "lock.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(.tint)
                Text(title)
                    .font(.title2.weight(.semibold))
                    .multilineTextAlignment(.center)
                dots
                Text(detail(lockedOut: lockedOut, now: context.date))
                    .font(.callout)
                    .foregroundStyle(lock.problem == nil ? Color.secondary : Color.red)
                    .multilineTextAlignment(.center)
                    .frame(minHeight: 44)
                    .padding(.horizontal)
                Spacer()
                keypad(disabled: lockedOut || lock.busy)
                    .padding(.bottom, 24)
            }
            .frame(maxWidth: .infinity)
            .overlay {
                if lock.busy, lock.problem != .storage {
                    ProgressView()
                }
            }
        }
    }

    private var title: String {
        switch lock.stage {
        case .create: "Create a 4-digit PIN"
        case .confirm: "Enter the PIN again"
        case .enter: "Enter your PIN"
        }
    }

    private func detail(lockedOut: Bool, now: Date) -> String {
        if lockedOut, let until = lock.lockedUntil {
            return "Too many wrong PINs. Try again in \(Format.duration(until.timeIntervalSince(now).rounded(.up)))."
        }
        switch lock.problem {
        case .mismatch: return "The PINs didn't match. Start again."
        case .wrong(let left): return left == 1 ? "Wrong PIN. 1 try left before a lockout." : "Wrong PIN. \(left) tries left before a lockout."
        case .storage: return "Polarsync can't read its secure storage. Close the app and open it again."
        case .locked, nil:
            return lock.stage == .create
                ? "There is no way to recover a forgotten PIN. Deleting the app resets it, along with all recordings."
                : ""
        }
    }

    private var dots: some View {
        HStack(spacing: 18) {
            ForEach(0..<PinManager.pinLength, id: \.self) { index in
                Circle()
                    .strokeBorder(Color.primary, lineWidth: 1.5)
                    .background(Circle().fill(index < lock.digitsEntered ? Color.primary : Color.clear))
                    .frame(width: 16, height: 16)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("\(lock.digitsEntered) of \(PinManager.pinLength) digits entered")
    }

    private func keypad(disabled: Bool) -> some View {
        let rows: [[String]] = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "⌫"]]
        return VStack(spacing: 14) {
            ForEach(rows, id: \.self) { row in
                HStack(spacing: 24) {
                    ForEach(row, id: \.self) { key in
                        keyButton(key)
                    }
                }
            }
        }
        .disabled(disabled)
        .opacity(disabled ? 0.4 : 1)
    }

    @ViewBuilder
    private func keyButton(_ key: String) -> some View {
        switch key {
        case "":
            Color.clear.frame(width: 76, height: 76)
        case "⌫":
            Button {
                lock.backspace()
            } label: {
                Image(systemName: "delete.left")
                    .font(.title2)
                    .frame(width: 76, height: 76)
            }
            .accessibilityLabel("Delete")
            .foregroundStyle(.primary)
        default:
            Button {
                lock.digit(Character(key))
            } label: {
                Text(key)
                    .font(.title.weight(.medium))
                    .frame(width: 76, height: 76)
                    .background(Circle().fill(Color.secondary.opacity(0.15)))
            }
            .foregroundStyle(.primary)
        }
    }
}
