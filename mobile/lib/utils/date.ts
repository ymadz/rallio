/**
 * Mobile-specific Date Utilities
 */

/**
 * Check if venue is currently open based on Manila timezone.
 * Matches web implementation: web/src/lib/api/venues.ts
 */
export function isVenueOpen(openingHours: Record<string, { open: string; close: string }> | string | null | undefined): boolean {
    if (!openingHours) return false;
    if (typeof openingHours === 'string') return true; // Assume open if no structured data but generic string like "Always Open"

    // Get current time in Manila timezone
    const manilaNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = dayNames[manilaNow.getDay()];

    const todayHours = openingHours[today];
    if (!todayHours) return false;

    const currentTime = manilaNow.getHours() * 100 + manilaNow.getMinutes();
    const openTime = parseInt(todayHours.open.replace(':', ''));
    const closeTime = parseInt(todayHours.close.replace(':', ''));

    // Handle overnight schedules (e.g. 10:00 PM to 2:00 AM)
    if (closeTime < openTime) {
        return currentTime >= openTime || currentTime <= closeTime;
    }

    return currentTime >= openTime && currentTime <= closeTime;
}

export function formatOperatingHours(openingHours: Record<string, { open: string; close: string }> | string | null | undefined): string {
    if (!openingHours) return 'Hours not available';
    if (typeof openingHours === 'string') return openingHours;

    const manilaNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = dayNames[manilaNow.getDay()];

    const todayHours = openingHours[today];
    if (!todayHours) return 'Closed today';

    return `${formatTime(todayHours.open)} - ${formatTime(todayHours.close)}`;
}

export function formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}:${minutes} ${ampm}`;
}
