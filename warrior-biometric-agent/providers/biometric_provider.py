from abc import ABC, abstractmethod
from typing import Callable, Dict, Any, List, Optional

class BiometricProvider(ABC):
    """
    Abstract Base Provider for Biometric Hardware Integration.
    Defines common lifecycle, event listening, user reading, and door control interfaces.
    """

    def __init__(self, device_id: str, device_name: str, host: str, port: int):
        self.device_id = device_id
        self.device_name = device_name
        self.host = host
        self.port = port
        self.is_running = False

    @abstractmethod
    def connect(self) -> bool:
        """Establishes connection to the biometric device."""
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Disconnects cleanly from the biometric device."""
        pass

    @abstractmethod
    def is_connected(self) -> bool:
        """Returns True if the hardware device is reachable and authenticated."""
        pass

    @abstractmethod
    def get_device_info(self) -> Dict[str, Any]:
        """Returns hardware metadata (model, serial, firmware, capabilities)."""
        pass

    @abstractmethod
    def get_users(self) -> List[Dict[str, Any]]:
        """Reads users currently enrolled on the device."""
        pass

    @abstractmethod
    def start_listening(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """
        Starts listening for real-time authentication events.
        Invokes callback with normalized punch event:
        {
            "deviceId": str,
            "deviceUserId": str,
            "memberId": Optional[str],
            "eventType": str,
            "timestamp": str (ISO),
            "verificationMethod": str,
            "deviceIp": str,
            "rawEventId": str,
            "source": str
        }
        """
        pass

    @abstractmethod
    def stop_listening(self) -> None:
        """Stops the real-time event listener."""
        pass

    @abstractmethod
    def open_door(self, door_id: int = 1, duration_seconds: int = 3) -> Dict[str, Any]:
        """
        Triggers remote gate/door relay unlock pulse.
        Returns {'success': bool, 'message': str, 'error': Optional[str]}
        """
        pass

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """Returns structured diagnostic status dictionary for CRM dashboard."""
        pass
