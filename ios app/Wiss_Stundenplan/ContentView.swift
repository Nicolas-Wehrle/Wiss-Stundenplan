//
//  ContentView.swift
//  Wiss_Stundenplan
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        StundenplanView()
            .ignoresSafeArea()          // the web app handles the safe areas itself (env(safe-area-inset-*))
            .background(Color(StundenplanWebViewController.backgroundColor).ignoresSafeArea())
    }
}

struct StundenplanView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> StundenplanWebViewController {
        StundenplanWebViewController()
    }

    func updateUIViewController(_ controller: StundenplanWebViewController, context: Context) {}
}

#Preview {
    ContentView()
}
