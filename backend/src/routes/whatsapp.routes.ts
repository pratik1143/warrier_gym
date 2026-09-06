import { Router } from 'express';
import { 
  getStatus, 
  connectWhatsApp, 
  disconnectWhatsApp, 
  reconnectWhatsApp, 
  sendTestMessage 
} from '../controllers/whatsapp.controller';

const router = Router();

router.get('/status', getStatus);
router.post('/connect', connectWhatsApp);
router.post('/disconnect', disconnectWhatsApp);
router.post('/reconnect', reconnectWhatsApp);
router.post('/test', sendTestMessage);

export default router;
