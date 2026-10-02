import Foundation
import Observation
import os
import PolarsyncCore

/// Gates the app behind the 4-digit PIN. The first launch asks the user to create and confirm one;
/// later launches ask for it. ``lock()`` is called whenever the app goes to the background.
@MainActor
@Observable
final class LockModel {

    enum Stage {
        case create, confirm, enter
    }

    enum Problem: Equatable {
        case mismatch
        case wrong(attemptsLeft: Int)
        case locked
        case storage
    }

    private(set) var unlocked = false
    private(set) var stage: Stage = .enter
    private(set) var digitsEntered = 0
    private(set) var busy = false
    private(set) var problem: Problem?
    /// Entry is blocked until this time.
    private(set) var lockedUntil: Date?

    @ObservationIgnored private let pins: PinManager
    @ObservationIgnored private var entry = ""
    @ObservationIgnored private var pinToConfirm: String?

    init(pins: PinManager) {
        self.pins = pins
        reset()
    }

    func isLockedOut(at now: Date) -> Bool {
        lockedUntil.map { now < $0 } ?? false
    }

    func digit(_ digit: Character) {
        guard !unlocked, !busy, entry.count < PinManager.pinLength, !isLockedOut(at: Date()) else { return }
        if problem == .locked { problem = nil }
        entry.append(digit)
        digitsEntered = entry.count
        if entry.count == PinManager.pinLength { submit(entry) }
    }

    func backspace() {
        guard !busy, !entry.isEmpty else { return }
        entry.removeLast()
        digitsEntered = entry.count
    }

    func lock() {
        entry = ""
        pinToConfirm = nil
        unlocked = false
        reset()
    }

    private func reset() {
        entry = ""
        digitsEntered = 0
        busy = false
        lockedUntil = nil
        problem = nil
        do {
            stage = try pins.isPinSet() ? .enter : .create
            let remaining = try pins.lockoutRemaining()
            if remaining > 0 {
                lockedUntil = Date().addingTimeInterval(remaining)
                problem = .locked
            }
        } catch {
            // Never fall back to "create a PIN" when the Keychain can't be read.
            Logger.security.error("PIN store unavailable: \(error.localizedDescription, privacy: .public)")
            stage = .enter
            problem = .storage
            busy = true
        }
    }

    private func submit(_ pin: String) {
        switch stage {
        case .create:
            pinToConfirm = pin
            clearEntry()
            stage = .confirm
            problem = nil

        case .confirm:
            guard pin == pinToConfirm else {
                pinToConfirm = nil
                clearEntry()
                stage = .create
                problem = .mismatch
                return
            }
            hashing { pins in
                try pins.setPin(pin)
                return .success
            }

        case .enter:
            hashing { pins in try pins.verify(pin) }
        }
    }

    /// PBKDF2 takes a moment; keep it off the main thread and ignore input meanwhile.
    private func hashing(_ work: @escaping @Sendable (PinManager) throws -> PinManager.Result) {
        busy = true
        let pins = self.pins
        Task {
            let result = await Task.detached(priority: .userInitiated) { Result { try work(pins) } }.value
            clearEntry()
            busy = false
            switch result {
            case .success(.success):
                pinToConfirm = nil
                problem = nil
                unlocked = true
            case .success(.wrong(let left)):
                problem = .wrong(attemptsLeft: left)
            case .success(.lockedOut(let until)):
                lockedUntil = Date(timeIntervalSince1970: until)
                problem = .locked
            case .failure(let error):
                Logger.security.error("PIN check failed: \(error.localizedDescription, privacy: .public)")
                problem = .storage
            }
        }
    }

    private func clearEntry() {
        entry = ""
        digitsEntered = 0
    }
}
