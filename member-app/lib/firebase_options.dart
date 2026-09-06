// Firebase configuration for alphagym-2d861
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        return android;
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyC6ac08ZuxkKK6DMbAq7TV6z1x2o1nHU7Q',
    authDomain: 'alphagym-2d861.firebaseapp.com',
    projectId: 'alphagym-2d861',
    storageBucket: 'alphagym-2d861.firebasestorage.app',
    messagingSenderId: '939171214881',
    appId: '1:939171214881:web:cf890446adc866b3285560',
    measurementId: 'G-769XM4BFQY',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyC6ac08ZuxkKK6DMbAq7TV6z1x2o1nHU7Q',
    appId: '1:939171214881:android:d55c318eb9b31eca285560',
    messagingSenderId: '939171214881',
    projectId: 'alphagym-2d861',
    storageBucket: 'alphagym-2d861.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyC6ac08ZuxkKK6DMbAq7TV6z1x2o1nHU7Q',
    appId: '1:939171214881:ios:a8fc76a07014a704285560',
    messagingSenderId: '939171214881',
    projectId: 'alphagym-2d861',
    storageBucket: 'alphagym-2d861.firebasestorage.app',
    iosBundleId: 'com.alphagym2d861ios',
  );
}
