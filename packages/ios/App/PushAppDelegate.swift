import FirebaseCore
import FirebaseMessaging
import UIKit

final class PushAppDelegate: NSObject, UIApplicationDelegate, MessagingDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
      let options = FirebaseOptions(contentsOfFile: path)
    {
      FirebaseApp.configure(options: options)
      Messaging.messaging().delegate = self
    }
    return true
  }
  func application(
    _ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    guard FirebaseApp.allApps?.isEmpty == false && FirebaseApp.app() != nil else { return }
    Messaging.messaging().apnsToken = deviceToken
  }
  func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    guard let token = fcmToken else { return }
    NotificationCenter.default.post(name: .vibeAllDayPushToken, object: token)
  }
}
extension Notification.Name { static let vibeAllDayPushToken = Notification.Name("vibeallday.native.push-token") }
