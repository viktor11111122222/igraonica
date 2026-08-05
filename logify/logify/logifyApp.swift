//
//  logifyApp.swift
//  logify
//
//  Created by Viktor Djordjevic on 26. 6. 2026..
//

import SwiftUI
import CoreData

@main
struct logifyApp: App {
    let persistenceController = PersistenceController.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.managedObjectContext, persistenceController.container.viewContext)
        }
    }
}
