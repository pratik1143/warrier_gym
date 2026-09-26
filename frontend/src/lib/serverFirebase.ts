import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = {
  type: "service_account",
  projectId: "thewarriergym",
  privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCmjVte3Q6s2AVS\nNGAiU8KcrdvgkdtrjN7nSJZmKnOIsiuQQmekeONqU2On0IKwf3sy5NjEu8loteyJ\nG3G7JdOKQSEp6ZAN00DMI0n4+jFdrNUB7FkSGGADp5ZH9WVx7WZIApTB+HXsQRLV\ns/uGeWduCNqIwaACa+Kyfo8pjvU2Mj/ItaMKrbgWOqDfYOgiNVI53yK6J6oZlMX4\nJXImqsrl8L/dUGlK/Hb0kEAO7fIq1LQ0vtG7ABIkyxJJGyN8fOOXqlfKUzGjGtgu\nJKzN1gE5HHqlQHQrLGHd4PW1+q/TuMKRNjVSftBkFAIUMdkXsBaclpxkES8BUC0k\noBpanZrrAgMBAAECggEAAVl12w/pdYcOi/r2qHCLTB+wf2JPJ9DtYWxaI5vGcd4X\nskSHeHKuTQc98HclB+8QfXoTM4zd9eY7c2Twh/anfyBF94P38dS7WqwShlzol3y2\nARz8H8Royr7J3e1kFAc7Y+v5bpTnx7FDSM37hLxpFSAnPSJsfHiJTq7t1AVfgT/l\noOvVmInoE+YSE0MTkFQ2/DIRfHbdHX3dc6vtoXnLTUPuGdQq2fyaP8wz4Rqn4kGe\nbxthClXBTQ6Z/ib15OvNoCdfW7ILRytJd6rnL1L9kAdNtdHtljwwGg10XHWe/sLB\ndQ5YpGfj8rqJwpE0OaMrw+f/emAVnhp+2hKF1TRbeQKBgQDYENS/y9NOfUzLzWQe\nS/0/rQP/F6zZrWUThOGpQ0Gcoc4ZU5xfkzukBGxBQtJ8xySs6M73DXC+RQ61YHwM\nZmHOasRgxCBdlctsZNUjw04EAgTnttKyl+q/7+zkMvuAMNvW55bKTuMnfhq++KLm\n1DVFVKfPldG/ycrXP4zIXByRZwKBgQDFVcl/RODdZcECOmlY0+pNK3G18GmpM06U\nTP6yhDsBZrxETcrZ6ifhsMQ2F4pZeC0LSSJnl3tBKYulWALdSlHHk5am9hhTOd+/\nNpIjNN9OM0y7XnPT0RMwCSpY58QmSsHRPMLB6cyqC9NsCUFtRyVKQNC5V2C0EWEy\n6MBxdnUj3QKBgQCNg5iUdj9T7SVbZo7oeQTJq9wuO6dueu70tdfHMNHMcP24ANcu\nkhRB/NOaetW5/AS9a04C6b6qIDjd+u/Ef1oYBD3S0yIPqYiu2evvnH+AiIIF8exW\nJMIQLGiPngSzlUynmM9eegS1XRbPdbHcVaj+W8/9Wjci0lwUVv8yS4I6iQKBgQC0\n9srlz4B3CA1Lwc1CDHRdeG2671G2PLre/QzFIMYLru8PpFdWJ4mTSstk34mcKr0E\nEHlgjmYVh8fsRR27WaBNaWdKjXwZNoWdkKnLZ30w9ZJ0cVW+9YinEICpL0GN7Bh5\njUL9GS768gVcmdBKKmhkA7Rlg1/HQfjk+tUgOAWMcQKBgQCveMr7DCv14ft6/yNs\nf8BrOhqBGrwWlZd8Xefmv2dH7dvA5S2IhVQcy4On5a63AssYpszkm1RGFocIhITk\nge/2OLR8CR9H5tmvfrT2lZoF/Xkf7s/QDWOCUT9WfDV+y4QHKABUzSaP9aryd+O9\nrroEpOam/0NIZzqNyudDubYIlA==\n-----END PRIVATE KEY-----\n",
  clientEmail: "firebase-adminsdk-fbsvc@thewarriergym.iam.gserviceaccount.com"
};

export function getAdminFirestore() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: 'thewarriergym.firebasestorage.app'
    });
  }
  return getFirestore();
}
