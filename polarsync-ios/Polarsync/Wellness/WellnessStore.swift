import Foundation
import Observation
import os
import PolarsyncCore
import UserNotifications

/// A reminder the user created.
struct CustomReminder: Identifiable, Codable, Equatable {
    enum Repeat: String, Codable, CaseIterable, Identifiable {
        case once, daily, weekly
        var id: String { rawValue }
        var label: String {
            switch self {
            case .once: "Once"
            case .daily: "Every day"
            case .weekly: "Every week"
            }
        }
    }

    var id = UUID()
    var title: String
    var date: Date
    var repeats: Repeat
    var mood: Mood
    var enabled = true
}

/// The four accent colours, used to tag reminders.
enum Mood: String, Codable, CaseIterable, Identifiable {
    case red, yellow, blue, green
    var id: String { rawValue }
}

/// Built-in check-ins (blink, water), custom reminders and today's water count.
/// Everything is delivered as local notifications, which a free Apple ID can sign.
@MainActor
@Observable
final class WellnessStore {

    static let maxCustomReminders = 20
    static let waterCategory = "WATER"
    static let drankAction = "DRANK"

    var blinkEnabled: Bool { didSet { saveAndReschedule() } }
    var blinkStartHour: Int {
        didSet {
            if blinkEndHour <= blinkStartHour { blinkEndHour = min(24, blinkStartHour + 1) }
            saveAndReschedule()
        }
    }
    var blinkEndHour: Int { didSet { saveAndReschedule() } }
    var waterEnabled: Bool { didSet { saveAndReschedule() } }
    private(set) var reminders: [CustomReminder]
    private(set) var waterLitresToday = 0
    private(set) var notificationsAllowed = true

    @ObservationIgnored private let defaults = UserDefaults.standard
    @ObservationIgnored private let center = UNUserNotificationCenter.current()
    @ObservationIgnored private var loading = true

    init() {
        blinkEnabled = defaults.object(forKey: Keys.blinkEnabled) as? Bool ?? true
        blinkStartHour = defaults.object(forKey: Keys.blinkStart) as? Int ?? 9
        blinkEndHour = defaults.object(forKey: Keys.blinkEnd) as? Int ?? 21
        waterEnabled = defaults.object(forKey: Keys.waterEnabled) as? Bool ?? true
        reminders = (defaults.data(forKey: Keys.reminders))
            .flatMap { try? JSONDecoder().decode([CustomReminder].self, from: $0) } ?? []
        loading = false
        refreshWater()
        registerCategories()
    }

    var waterTimes: [HourMinute] { WellnessSchedule.waterTimes() }
    var waterGoalLitres: Int { waterTimes.count }
    var blinkTimes: [HourMinute] { WellnessSchedule.blinkTimes(startHour: blinkStartHour, endHour: blinkEndHour) }

    func nextBlink(after now: Date = Date()) -> Date? {
        blinkEnabled ? WellnessSchedule.next(after: now, times: blinkTimes) : nil
    }

    func nextWater(after now: Date = Date()) -> Date? {
        waterEnabled ? WellnessSchedule.next(after: now, times: waterTimes) : nil
    }

    // MARK: Water

    func logWater() {
        waterLitresToday += 1
        defaults.set(waterLitresToday, forKey: Keys.water(WellnessSchedule.dayKey(Date())))
    }

    func undoWater() {
        guard waterLitresToday > 0 else { return }
        waterLitresToday -= 1
        defaults.set(waterLitresToday, forKey: Keys.water(WellnessSchedule.dayKey(Date())))
    }

    /// Re-reads today's count (it resets at midnight).
    func refreshWater() {
        waterLitresToday = defaults.integer(forKey: Keys.water(WellnessSchedule.dayKey(Date())))
    }

    // MARK: Custom reminders

    var canAddReminder: Bool { reminders.count < Self.maxCustomReminders }

    func save(_ reminder: CustomReminder) {
        if let index = reminders.firstIndex(where: { $0.id == reminder.id }) {
            reminders[index] = reminder
        } else if canAddReminder {
            reminders.append(reminder)
        }
        reminders.sort { $0.date.timeOfDay < $1.date.timeOfDay }
        saveAndReschedule()
    }

    func delete(_ reminder: CustomReminder) {
        reminders.removeAll { $0.id == reminder.id }
        saveAndReschedule()
    }

    func toggle(_ reminder: CustomReminder) {
        var updated = reminder
        updated.enabled.toggle()
        save(updated)
    }

    // MARK: Notifications

    /// Asks once; afterwards reflects the user's choice in Settings.
    func requestPermission() async {
        do {
            notificationsAllowed = try await center.requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            notificationsAllowed = false
        }
        reschedule()
    }

    func refreshPermission() async {
        let settings = await center.notificationSettings()
        notificationsAllowed = settings.authorizationStatus != .denied
    }

    private func registerCategories() {
        let drank = UNNotificationAction(identifier: Self.drankAction, title: "Drank 1 L 💧", options: [])
        let water = UNNotificationCategory(identifier: Self.waterCategory, actions: [drank], intentIdentifiers: [])
        center.setNotificationCategories([water])
    }

    private func saveAndReschedule() {
        guard !loading else { return }
        defaults.set(blinkEnabled, forKey: Keys.blinkEnabled)
        defaults.set(blinkStartHour, forKey: Keys.blinkStart)
        defaults.set(blinkEndHour, forKey: Keys.blinkEnd)
        defaults.set(waterEnabled, forKey: Keys.waterEnabled)
        if let data = try? JSONEncoder().encode(reminders) {
            defaults.set(data, forKey: Keys.reminders)
        }
        reschedule()
    }

    /// Replaces every pending notification with the current schedule.
    func reschedule() {
        center.removeAllPendingNotificationRequests()
        var requests: [UNNotificationRequest] = []

        if blinkEnabled {
            for time in blinkTimes {
                requests.append(request(
                    id: "blink-\(time.hour)-\(time.minute)",
                    title: "Blink break 👀",
                    body: "Look away from the screen and blink slowly 10 times.",
                    trigger: DateComponents(hour: time.hour, minute: time.minute),
                    repeats: true
                ))
            }
        }
        if waterEnabled {
            for time in waterTimes {
                requests.append(request(
                    id: "water-\(time.hour)",
                    title: "Water check-in 💧",
                    body: "Time to drink 1 litre of water.",
                    trigger: DateComponents(hour: time.hour, minute: time.minute),
                    repeats: true,
                    category: Self.waterCategory
                ))
            }
        }
        let calendar = Calendar.current
        for reminder in reminders where reminder.enabled {
            let components: DateComponents
            switch reminder.repeats {
            case .once:
                guard reminder.date > Date() else { continue }
                components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: reminder.date)
            case .daily:
                components = calendar.dateComponents([.hour, .minute], from: reminder.date)
            case .weekly:
                components = calendar.dateComponents([.weekday, .hour, .minute], from: reminder.date)
            }
            requests.append(request(
                id: "custom-\(reminder.id.uuidString)",
                title: reminder.title,
                body: "Reminder from Polarbear",
                trigger: components,
                repeats: reminder.repeats != .once
            ))
        }

        for request in requests.prefix(WellnessSchedule.notificationLimit) {
            center.add(request) { error in
                if let error {
                    Logger.wellness.error("Schedule failed: \(error.localizedDescription, privacy: .public)")
                }
            }
        }
        Logger.wellness.info("Scheduled \(min(requests.count, WellnessSchedule.notificationLimit)) notifications")
    }

    private func request(
        id: String,
        title: String,
        body: String,
        trigger components: DateComponents,
        repeats: Bool,
        category: String? = nil
    ) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default // Vibrates when the phone is on silent, if vibration is on in Settings.
        if let category { content.categoryIdentifier = category }
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: repeats)
        return UNNotificationRequest(identifier: id, content: content, trigger: trigger)
    }

    private enum Keys {
        static let blinkEnabled = "blinkEnabled"
        static let blinkStart = "blinkStartHour"
        static let blinkEnd = "blinkEndHour"
        static let waterEnabled = "waterEnabled"
        static let reminders = "customReminders"
        static func water(_ day: String) -> String { "water-\(day)" }
    }
}

/// Shows banners while the app is open and handles the "Drank 1 L" button.
final class NotificationHandler: NSObject, UNUserNotificationCenterDelegate {
    weak var store: WellnessStore?

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard response.actionIdentifier == WellnessStore.drankAction else { return }
        await MainActor.run { store?.logWater() }
    }
}

extension Date {
    var timeOfDay: Int {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: self)
        return (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
    }
}

extension Logger {
    static let wellness = Logger(subsystem: "io.github.polarsync", category: "Wellness")
}
