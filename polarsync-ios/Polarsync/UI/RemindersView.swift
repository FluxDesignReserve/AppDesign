import SwiftUI

/// Reminders tab: the user's own reminders as colour cards.
struct RemindersView: View {
    @Environment(WellnessStore.self) private var wellness
    @State private var editing: CustomReminder?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Reminders")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .padding(.top, 24)

                    if wellness.reminders.isEmpty {
                        MoodCard(color: Theme.yellow) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("No reminders yet")
                                    .font(.headline)
                                Text("Tap + to add one: a title, a time, and how often it repeats.")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.secondaryText)
                            }
                        }
                    }

                    ForEach(wellness.reminders) { reminder in
                        ReminderCard(reminder: reminder) {
                            editing = reminder
                        } onToggle: {
                            wellness.toggle(reminder)
                        }
                    }

                    Button {
                        editing = CustomReminder(
                            title: "",
                            date: Date().addingTimeInterval(3600),
                            repeats: .daily,
                            mood: .yellow
                        )
                    } label: {
                        Label("Add reminder", systemImage: "plus")
                    }
                    .buttonStyle(PillButtonStyle(color: Theme.yellow))
                    .disabled(!wellness.canAddReminder)
                    .padding(.top, 6)

                    if !wellness.canAddReminder {
                        Text("You can have up to \(WellnessStore.maxCustomReminders) reminders.")
                            .font(.footnote)
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
            .background(ScreenBackground(glow: [Theme.yellow, Theme.red]))
            .toolbar(.hidden, for: .navigationBar)
            .sheet(item: $editing) { reminder in
                ReminderEditor(reminder: reminder, isNew: !wellness.reminders.contains { $0.id == reminder.id })
            }
        }
    }
}

private struct ReminderCard: View {
    let reminder: CustomReminder
    let onEdit: () -> Void
    let onToggle: () -> Void

    var body: some View {
        MoodCard(color: reminder.mood.color) {
            HStack(spacing: 14) {
                Circle()
                    .fill(reminder.mood.color)
                    .frame(width: 14, height: 14)
                VStack(alignment: .leading, spacing: 4) {
                    Text(reminder.title)
                        .font(.headline)
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                }
                Spacer()
                Toggle(reminder.title, isOn: Binding(get: { reminder.enabled }, set: { _ in onToggle() }))
                    .labelsHidden()
                    .tint(reminder.mood.color)
            }
            .opacity(reminder.enabled ? 1 : 0.5)
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onEdit)
    }

    private var subtitle: String {
        let time = reminder.date.formatted(date: .omitted, time: .shortened)
        switch reminder.repeats {
        case .once: return reminder.date.formatted(date: .abbreviated, time: .shortened)
        case .daily: return "Every day at \(time)"
        case .weekly: return "Every \(reminder.date.formatted(.dateTime.weekday(.wide))) at \(time)"
        }
    }
}

/// Add or edit a reminder.
private struct ReminderEditor: View {
    @Environment(WellnessStore.self) private var wellness
    @Environment(\.dismiss) private var dismiss
    @State var reminder: CustomReminder
    let isNew: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("What should I remind you about?", text: $reminder.title)
                }
                Section {
                    Picker("Repeat", selection: $reminder.repeats) {
                        ForEach(CustomReminder.Repeat.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                    if reminder.repeats == .daily {
                        DatePicker("Time", selection: $reminder.date, displayedComponents: .hourAndMinute)
                    } else {
                        DatePicker("When", selection: $reminder.date, in: Date()...)
                    }
                }
                Section("Colour") {
                    HStack(spacing: 18) {
                        ForEach(Mood.allCases) { mood in
                            Circle()
                                .fill(mood.color)
                                .frame(width: 36, height: 36)
                                .overlay {
                                    if reminder.mood == mood {
                                        Circle().strokeBorder(.white, lineWidth: 3)
                                    }
                                }
                                .onTapGesture { reminder.mood = mood }
                                .accessibilityLabel(mood.rawValue)
                                .accessibilityAddTraits(reminder.mood == mood ? .isSelected : [])
                        }
                    }
                    .padding(.vertical, 4)
                }
                if !isNew {
                    Section {
                        Button("Delete reminder", role: .destructive) {
                            wellness.delete(reminder)
                            dismiss()
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle(isNew ? "New reminder" : "Edit reminder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        reminder.title = reminder.title.trimmingCharacters(in: .whitespacesAndNewlines)
                        reminder.enabled = true
                        wellness.save(reminder)
                        dismiss()
                    }
                    .disabled(reminder.title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.large])
    }
}
