'use client';

export function useLocation() {
  const updateLocation = async () => {
    if (!('geolocation' in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await fetch('/api/user/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        });
      },
      (err) => console.warn('Location denied:', err.message),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  /**
   * Resolves with coords if permission is already granted (no prompt),
   * otherwise resolves null.
   */
  const getLocationIfGranted = (): Promise<GeolocationCoordinates | null> => {
    return new Promise((resolve) => {
      if (!('permissions' in navigator)) {
        resolve(null);
        return;
      }
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state !== 'granted') {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 10000 }
        );
      }).catch(() => resolve(null));
    });
  };

  return { updateLocation, getLocationIfGranted };
}
