// Format price to remove .00 for whole numbers
export function formatPrice(price) {
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return price;
    
    // Round to 2 decimal places to handle floating point precision issues
    const roundedPrice = Math.round(numPrice * 100) / 100;
    
    // If it's a whole number (or very close to it due to rounding), return without decimals
    if (Math.abs(roundedPrice % 1) < 0.001) {
        return Math.round(roundedPrice).toString();
    }
    return roundedPrice.toFixed(2);
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

