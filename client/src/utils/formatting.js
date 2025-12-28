// Format price to remove .00 for whole numbers
export function formatPrice(price) {
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return price;
    // If it's a whole number, return without decimals, otherwise return with 2 decimals
    if (numPrice % 1 === 0) {
        return numPrice.toString();
    }
    return numPrice.toFixed(2);
}

// Format time to HH:MM format
export function formatTime(time) {
    if (!time) return time;
    const timeStr = String(time).trim();
    // If already in HH:MM format, return as is
    if (/^\d{2}:\d{2}$/.test(timeStr)) {
        return timeStr;
    }
    // If in HH:MM:SS format, extract HH:MM
    if (/^\d{2}:\d{2}:\d{2}/.test(timeStr)) {
        return timeStr.substring(0, 5);
    }
    // Try to parse and format
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
        const hours = parts[0].padStart(2, '0');
        const minutes = parts[1].padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    return timeStr;
}

