const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const philippineHolidaysByYear = {
    2026: [
        { date: "2026-01-01", name: "New Year's Day" },
        { date: "2026-02-17", name: "Chinese New Year" },
        { date: "2026-04-02", name: "Maundy Thursday" },
        { date: "2026-04-03", name: "Good Friday" },
        { date: "2026-04-04", name: "Holy Saturday" },
        { date: "2026-04-09", name: "Day of Valor" },
        { date: "2026-05-01", name: "Labour Day" },
        { date: "2026-06-12", name: "Independence Day" },
        { date: "2026-08-21", name: "Ninoy Aquino Day" },
        { date: "2026-08-31", name: "National Heroes Day" },
        { date: "2026-10-31", name: "All Saints' Day Eve" },
        { date: "2026-11-01", name: "All Saints' Day" },
        { date: "2026-11-30", name: "Bonifacio Day" },
        { date: "2026-12-08", name: "Feast of the Immaculate Conception" },
        { date: "2026-12-24", name: "Christmas Eve" },
        { date: "2026-12-25", name: "Christmas Day" },
        { date: "2026-12-30", name: "Rizal Day" },
        { date: "2026-12-31", name: "Last Day of the Year" }
    ]
};
const holidayDataByYear = new Map(
    Object.entries(philippineHolidaysByYear).map(([year, holidays]) => [Number(year), holidays])
);
const requestedHolidayYears = new Set();
const failedHolidayYears = new Set();
const holidayCacheLifetime = 7 * 24 * 60 * 60 * 1000;
let lastDate = "";
let midnightTimer;

// Compare local calendar dates without daylight-saving offsets.
function dayNumber(year, month, date) {
    return Date.UTC(year, month, date) / 86400000;
}

// Measure how many monospace characters fit in the bar's current width.
function characterCount(bar) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const style = getComputedStyle(bar);
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return Math.max(1, Math.floor(bar.clientWidth / context.measureText("█").width));
}

function updateFrame() {
    const frame = document.getElementById("page-frame");
    const style = getComputedStyle(frame);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

    const characterWidth = context.measureText("-").width;
    const lineHeight = Number.parseFloat(style.lineHeight);
    const columns = Math.max(1, Math.floor(frame.clientWidth / characterWidth) - 2);
    const rows = Math.max(1, Math.floor(frame.clientHeight / lineHeight) - 2);
    const horizontal = `+${"-".repeat(columns)}+`;
    const vertical = `:${" ".repeat(columns)}:`;

    frame.textContent = [horizontal, ...Array(rows).fill(vertical), horizontal].join("\n");
}

function updateBar(id, percentage) {
    const bar = document.getElementById(id);
    const length = characterCount(bar);
    const filledCount = Math.round(length * percentage / 100);

    const filled = document.createElement("span");
    filled.className = "filled";
    filled.textContent = "█".repeat(filledCount);

    const empty = document.createElement("span");
    empty.className = "empty";
    empty.textContent = "▒".repeat(length - filledCount);

    bar.replaceChildren(filled, empty);
    bar.setAttribute("aria-valuenow", percentage.toFixed(2));
}

function updateTrackers(today) {
    const year = today.getFullYear();
    const currentDay = dayNumber(year, today.getMonth(), today.getDate());
    const yearStart = dayNumber(year, 0, 1);
    const nextYear = dayNumber(year + 1, 0, 1);
    const yearLength = nextYear - yearStart;
    const dayOfYear = currentDay - yearStart + 1;
    const remaining = nextYear - currentDay - 1;

    // Today is included in year progress, but excluded from remaining days.
    const yearPercentage = dayOfYear / yearLength * 100;
    document.getElementById("year-title").textContent =
        `YEARLY PROGRESS BAR // ${year}`;
    document.getElementById("year-details").textContent =
        `${yearPercentage.toFixed(2)}% | day ${dayOfYear}/${yearLength}` +
        ` | ${remaining} days remaining (after today)`;
    updateBar("year-bar", yearPercentage);

    const gameStart = dayNumber(2026, 2, 19);
    const gameRelease = dayNumber(2031, 2, 19);
    const duration = gameRelease - gameStart;
    const elapsed = Math.max(0, Math.min(duration, currentDay - gameStart));
    const daysBeforeRelease = Math.max(0, gameRelease - currentDay - 1);
    const gamePercentage = elapsed / duration * 100;

    document.getElementById("game-details").textContent =
        `${gamePercentage.toFixed(2)}% | ${elapsed}/${duration} days elapsed` +
        ` | ${daysBeforeRelease} full days before release (after today)`;
    updateBar("game-bar", gamePercentage);
}

function buildHolidayList(year, holidays) {
    const list = document.getElementById("holiday-list");
    const status = document.getElementById("holiday-status");
    list.replaceChildren();

    for (const holiday of holidays) {
        const [, month, day] = holiday.date.split("-").map(Number);
        const item = document.createElement("li");
        const date = document.createElement("span");
        const name = document.createElement("span");
        date.className = "holiday-date";
        date.textContent = `${monthNames[month - 1].slice(0, 3)} ${day}`;
        name.textContent = holiday.name;
        item.append(date, name);
        list.append(item);
    }

    list.setAttribute("aria-label", `${year} Philippine public holidays`);
    status.hidden = holidays.length > 0 || !failedHolidayYears.has(year);
    status.textContent = status.hidden ? "" : `Holiday data for ${year} is unavailable.`;
}

function applyHolidayData(year, holidays) {
    if (document.getElementById("calendar-title").textContent !== `CALENDAR // ${year}`) {
        return;
    }

    buildHolidayList(year, holidays);
    const holidaysByDate = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));

    document.querySelectorAll("td.holiday").forEach((cell) => {
        cell.classList.remove("holiday");
        cell.removeAttribute("title");
        cell.removeAttribute("aria-label");
    });

    document.querySelectorAll(".month").forEach((monthBox, month) => {
        monthBox.querySelectorAll("td").forEach((cell) => {
            const day = Number(cell.textContent);
            if (!day) {
                return;
            }

            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const holiday = holidaysByDate.get(dateKey);
            if (!holiday) {
                return;
            }

            cell.classList.add("holiday");
            cell.title = holiday;
            cell.setAttribute("aria-label", `${monthNames[month]} ${day}, ${year}: ${holiday}`);
        });
    });
}

function readHolidayCache(year) {
    try {
        const cached = JSON.parse(localStorage.getItem(`philippine-holidays-${year}`));
        if (!cached || !Number.isFinite(cached.checkedAt) || !Array.isArray(cached.holidays)) {
            return null;
        }

        cached.holidays = cached.holidays
            .filter((holiday) => holiday && /^\d{4}-\d{2}-\d{2}$/.test(holiday.date) && typeof holiday.name === "string")
            .map(({ date, name }) => ({ date, name }));
        return cached;
    } catch {
        return null;
    }
}

function writeHolidayCache(year, holidays, unavailable) {
    try {
        localStorage.setItem(`philippine-holidays-${year}`, JSON.stringify({
            checkedAt: Date.now(),
            unavailable,
            holidays
        }));
    } catch {
        // Continue with the in-memory data if storage is unavailable.
    }
}

async function loadHolidayData(year) {
    if (requestedHolidayYears.has(year)) {
        return;
    }

    requestedHolidayYears.add(year);
    const cached = readHolidayCache(year);
    if (cached) {
        holidayDataByYear.set(year, cached.holidays);
        if (cached.unavailable) {
            failedHolidayYears.add(year);
        } else {
            failedHolidayYears.delete(year);
        }
        applyHolidayData(year, cached.holidays);
        if (Date.now() - cached.checkedAt < holidayCacheLifetime) {
            return;
        }
    }

    try {
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/PH`);
        if (!response.ok) {
            throw new Error(`Holiday request failed: ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error("Holiday response was not a list.");
        }

        const holidays = data
            .filter((holiday) => holiday && /^\d{4}-\d{2}-\d{2}$/.test(holiday.date) && typeof holiday.name === "string")
            .map(({ date, name }) => ({ date, name }));
        holidayDataByYear.set(year, holidays);
        failedHolidayYears.delete(year);
        writeHolidayCache(year, holidays, false);
        if (document.getElementById("calendar-title").textContent === `CALENDAR // ${year}`) {
            applyHolidayData(year, holidays);
        }
    } catch {
        failedHolidayYears.add(year);
        const holidays = holidayDataByYear.get(year) || [];
        writeHolidayCache(year, holidays, true);
        applyHolidayData(year, holidays);
    }
}

function buildCalendar(today) {
    const year = today.getFullYear();
    const currentDay = dayNumber(year, today.getMonth(), today.getDate());
    const calendar = document.getElementById("calendar");
    document.getElementById("calendar-title").textContent = `CALENDAR // ${year}`;
    calendar.replaceChildren();

    for (let month = 0; month < 12; month++) {
        const monthBox = document.createElement("div");
        monthBox.className = "month";
        const heading = document.createElement("h3");
        heading.textContent = `${monthNames[month]} ${year}`;
        monthBox.append(heading);

        const table = document.createElement("table");
        table.setAttribute("aria-label", heading.textContent);
        const header = table.createTHead().insertRow();

        for (const weekday of weekdays) {
            const cell = document.createElement("th");
            cell.scope = "col";
            cell.textContent = weekday;
            header.append(cell);
        }

        const body = table.createTBody();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

        for (let week = 0; week < 6; week++) {
            const row = body.insertRow();

            for (let weekday = 0; weekday < 7; weekday++) {
                const cell = row.insertCell();
                const date = week * 7 + weekday - firstWeekday + 1;

                if (date < 1 || date > daysInMonth) {
                    continue;
                }

                cell.textContent = date;
                const calendarDay = dayNumber(year, month, date);

                if (calendarDay < currentDay) {
                    cell.classList.add("past");
                } else if (calendarDay === currentDay) {
                    cell.classList.add("today");
                    cell.setAttribute("aria-current", "date");
                }
            }
        }

        monthBox.append(table);
        calendar.append(monthBox);
    }

    applyHolidayData(year, holidayDataByYear.get(year) || []);
}

function refresh() {
    clearTimeout(midnightTimer);
    updateFrame();
    const today = new Date();
    const dateKey = today.toDateString();

    updateTrackers(today);
    loadHolidayData(today.getFullYear());

    if (dateKey !== lastDate) {
        buildCalendar(today);
        lastDate = dateKey;
    }

    const now = new Date();
    const nextMidnight = new Date(
        now.getFullYear(), now.getMonth(), now.getDate() + 1
    );
    midnightTimer = setTimeout(refresh, nextMidnight - now + 100);
}

refresh();
window.addEventListener("focus", refresh);
window.addEventListener("pageshow", refresh);
window.addEventListener("resize", refresh);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        refresh();
    }
});
