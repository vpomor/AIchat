"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ClockRewind, Edit01, Image01, MessageSquare02, Microphone01, Send01, X as XClose } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { cx } from "@/utils/cx";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "chat" | "map";
type MapOverlay = "none" | "forecast" | "events" | "heatmap";

interface AiTextMsg {
    id: string;
    role: "ai-text";
    time: string;
    text: string;
}
interface UserMsg {
    id: string;
    role: "user";
    time: string;
    text: string;
}
interface AiSearchResultMsg {
    id: string;
    role: "ai-search-result";
    time: string;
    plate: string;
    address: string;
    total: number;
    shown: number;
}

interface AiReportsMsg {
    id: string;
    role: "ai-reports";
    time: string;
    reports: { title: string; location: string; size: string }[];
}

interface AiVideoMsg {
    id: string;
    role: "ai-video";
    time: string;
    label: string;
    currentTime: string;
    remaining: string;
}

interface AiVisualSearchMsg {
    id: string;
    role: "ai-visual-search";
    time: string;
    count: number;
    description: string;
    dateRange: string;
}

interface AiHeatmapMsg {
    id: string;
    role: "ai-heatmap";
    time: string;
}

type ChatMessage = AiTextMsg | UserMsg | AiSearchResultMsg | AiReportsMsg | AiVideoMsg | AiVisualSearchMsg | AiHeatmapMsg;

// ─── Event item type (shared between list and detail panel) ───────────────────

interface EventItem {
    id: string;
    plate: string;
    speed: number;
    direction: string;
    camera: string;
    cameraAddress: string;
    carBg: string;
    carColor: string; // for SVG rendering
    time: string;
    // detail panel fields
    datetime: string;
    vehicleType: string;
    make: string;
    color: string;
    violation: string;
    allowedSpeed: number;
    location: string;
    cameraIp: string;
    dangerousType?: string;
}

// ─── Static data ──────────────────────────────────────────────────────────────

// Messages for the plate-search flow
const PLATE_SEARCH_MESSAGES: ChatMessage[] = [
    { id: "1", role: "ai-text", time: "только что", text: "Я помощник Sergek, чем могу помочь?" },
    { id: "2", role: "user", time: "только что", text: "Найди машину с номером 123QWE01" },
    { id: "3", role: "ai-search-result", time: "только что", plate: "123QWE01", address: "ул. Карасай батыра (адрес АПК)", total: 170, shown: 50 },
];

// Messages for the foreign-vehicles flow
const FOREIGN_VEHICLES_MESSAGES: ChatMessage[] = [
    { id: "1", role: "ai-text", time: "2 мин назад", text: "Я помощник Sergek, чем могу помочь?" },
    { id: "2", role: "user", time: "3 мин назад", text: "Сколько было иностранных ТС за январь 2025 года в Алматы?" },
    {
        id: "3", role: "ai-reports", time: "минуту назад",
        reports: [
            { title: "Кол-во иностранных ТС за январь 2025 года", location: "Алматы", size: "200 КВ" },
            { title: "Кол-во иностранных ТС за январь 2025 года", location: "Алматинская область", size: "200 КВ" },
            { title: "Кол-во иностранных ТС за февраль 2025 года", location: "Алматы", size: "200 КВ" },
        ],
    },
    { id: "4", role: "ai-video", time: "минуту назад", label: "Иностранные ТС", currentTime: "1:34", remaining: "-3:40" },
];

// Placeholder response for flows not yet implemented
const placeholderResponse = (text: string): AiTextMsg => ({
    id: "r1", role: "ai-text", time: "только что", text,
});

type SuggestionId = "plate-search" | "foreign-vehicles" | "visual-search" | "dangerous-driving" | "heatmap";

interface Suggestion {
    id: SuggestionId;
    icon: React.ReactNode;
    label: string;
    userText: string;
}

const SuggestionIcon = ({ children }: { children: React.ReactNode }) => (
    <span className="text-lg leading-none" aria-hidden="true">{children}</span>
);

const SUGGESTIONS: Suggestion[] = [
    {
        id: "plate-search",
        icon: <SuggestionIcon>🔍</SuggestionIcon>,
        label: "Найди машину с номером",
        userText: "Найди машину с номером 123QWE01",
    },
    {
        id: "foreign-vehicles",
        icon: <SuggestionIcon>🌍</SuggestionIcon>,
        label: "Сколько было иностранных ТС за январь 2025 года в Алматы?",
        userText: "Сколько было иностранных ТС за январь 2025 года в Алматы?",
    },
    {
        id: "visual-search",
        icon: <SuggestionIcon>🎥</SuggestionIcon>,
        label: "Найди белую Камри по городу за последние сутки",
        userText: "Найди белую Камри по городу за последние сутки",
    },
    {
        id: "dangerous-driving",
        icon: <SuggestionIcon>⚠️</SuggestionIcon>,
        label: "Покажи события с опасным вождением за последние сутки в Астане",
        userText: "Покажи события с опасным вождением за последние сутки в Астане",
    },
    {
        id: "heatmap",
        icon: <SuggestionIcon>🗺️</SuggestionIcon>,
        label: "Покажи тепловую карту ДТП за последний месяц",
        userText: "Покажи тепловую карту ДТП за последний месяц",
    },
];

const mkEvent = (
    id: string, plate: string, speed: number, direction: string,
    camera: string, cameraAddress: string, carBg: string, carColor: string, time: string,
    datetime: string, vehicleType: string, make: string, color: string,
    violation: string, allowedSpeed: number, location: string, cameraIp: string,
): EventItem => ({ id, plate, speed, direction, camera, cameraAddress, carBg, carColor, time, datetime, vehicleType, make, color, violation, allowedSpeed, location, cameraIp });

const EVENTS: EventItem[] = [
    mkEvent("1",  "088 AQX 05", 89,  "пр. Кабанбай Батыра в сторону ул. Достык, пересе...", "ЛУ 130", "пр. Кабанбай Батыра в сторону ул. Достык...",        "#8fa0b8", "#c0c8d4", "09:14", "09.12.2025, 09:14", "Легковой", "Hyundai Sonata",  "Серебристый",  "Превышение скорости", 60, "пр. Кабанбай Батыра, пересечение с ул. Достык",          "192.168.1.10"),
    mkEvent("2",  "313BAD02",   68,  "ул. Достык в сторону пр. Мангилик Ел, район Байте...", "ЛУ 130", "ул. Кабанбай батыр, остановка «Дачный м...",           "#e07c34", "#e07c34", "09:17", "09.12.2025, 09:17", "Легковой", "BYD Han",        "Оранжевый",    "Превышение скорости", 60, "ул. Достык в сторону пр. Мангилик Ел, район Байтерека",   "192.168.1.11"),
    mkEvent("3",  "777ARM01",   112, "пр. Аль-Фараби в сторону ул. Фурманова, развязка...", "ЛУ 204", "пр. Аль-Фараби, пересечение с ул. Хаджи Мукан",       "#4a6741", "#5a7a50", "09:21", "09.12.2025, 09:21", "Легковой", "Toyota Corolla", "Тёмно-зелёный","Превышение скорости", 80, "пр. Аль-Фараби, развязка у ул. Фурманова",               "192.168.1.12"),
    mkEvent("4",  "123QWE01",   74,  "ул. Карасай батыра в сторону ул. Шевченко, центр...", "ЛУ 087", "ул. Карасай батыра, д. 58А",                           "#2c4a7c", "#3a5fa0", "09:25", "09.12.2025, 09:25", "Легковой", "Toyota Camry",   "Синий",        "Превышение скорости", 60, "ул. Карасай батыра, у д. 58А",                           "192.168.1.13"),
    mkEvent("5",  "A555BB02",   58,  "ул. Сейфуллина в сторону пр. Назарбаева, перекр...",  "ЛУ 311", "ул. Сейфуллина, остановка «Площадь»",                  "#c0392b", "#d44030", "09:28", "09.12.2025, 09:28", "Легковой", "Kia K5",         "Красный",      "Нарушение разметки",  60, "ул. Сейфуллина, перекрёсток с пр. Назарбаева",           "192.168.1.14"),
    mkEvent("6",  "098TKZ07",   93,  "пр. Назарбаева в сторону ул. Толе би, светофор...",   "ЛУ 156", "пр. Назарбаева, пересечение с ул. Гоголя",             "#7d6e83", "#9a8a99", "09:31", "09.12.2025, 09:31", "Легковой", "Lada Vesta",     "Серый",        "Превышение скорости", 80, "пр. Назарбаева, светофор у ул. Толе би",                 "192.168.1.15"),
    mkEvent("7",  "Z001AZ01",   61,  "ул. Гоголя в сторону ул. Панфилова, квартал...",      "ЛУ 042", "ул. Гоголя, 20 — у ТЦ «Мегацентр»",                   "#1a7a5e", "#22a07c", "09:35", "09.12.2025, 09:35", "Легковой", "Chevrolet Malibu","Тёмно-зелёный","Превышение скорости", 60, "ул. Гоголя, квартал у ТЦ «Мегацентр»",                  "192.168.1.16"),
    mkEvent("8",  "555KAZ01",   80,  "ул. Байтурсынова в сторону ул. Абая, пересечен...",   "ЛУ 219", "ул. Байтурсынова, напротив БЦ «Алатау»",               "#8e6b23", "#b08030", "09:38", "09.12.2025, 09:38", "Легковой", "Mercedes E-class","Золотистый",  "Превышение скорости", 60, "ул. Байтурсынова, напротив БЦ «Алатау»",                 "192.168.1.17"),
    mkEvent("9",  "B777BB77",   105, "пр. Абая в сторону ул. Тимирязева, обгон...",         "ЛУ 178", "пр. Абая, 150 — Дворец спорта",                        "#34495e", "#445870", "09:42", "09.12.2025, 09:42", "Легковой", "BMW 5 series",   "Тёмно-синий",  "Превышение скорости", 80, "пр. Абая, 150 — у Дворца спорта",                        "192.168.1.18"),
    mkEvent("10", "099ARG04",   71,  "ул. Розыбакиева в сторону пр. Раимбека, развяз...",   "ЛУ 063", "ул. Розыбакиева, поворот на пр. Раимбека",             "#6d4c41", "#8a6052", "09:45", "09.12.2025, 09:45", "Легковой", "Nissan Qashqai", "Коричневый",   "Превышение скорости", 60, "ул. Розыбакиева, поворот на пр. Раимбека",               "192.168.1.19"),
];

const VISUAL_SEARCH_EVENTS: EventItem[] = [
    mkEvent("v1",  "088 AQX 05", 89,  "пр. Кабанбай Батыра в сторону ул. Достык, пересе...", "ЛУ 130", "пр. Кабанбай Батыра в сторону ул. Достык...",    "#8fa0b8", "#c0c8d4", "09:14", "01.01.2024, 09:14", "Легковой", "Toyota Camry",   "Белый", "Превышение скорости", 60, "пр. Кабанбай Батыра, пересечение с ул. Достык",  "192.168.1.1"),
    mkEvent("v2",  "313BAD02",   68,  "ул. Достык в сторону пр. Мангилик Ел, район Байте...", "ЛУ 130", "ул. Кабанбай батыр, остановка «Дачный м...",       "#e07c34", "#e07c34", "09:17", "01.01.2024, 09:17", "Легковой", "Toyota Camry",   "Белый", "Превышение скорости", 60, "ул. Достык в сторону пр. Мангилик Ел, Байтерека", "192.168.1.1"),
    mkEvent("v3",  "219BBK13",   73,  "ул. Сарайшик, пересечение с ул. Акмешитоле би",        "ЛУ 130", "ул. Сарайшик, пересечение с ул. Акмешитоле",       "#d0d8e4", "#dde4ec", "09:31", "01.01.2024, 09:31", "Грузовой", "Volvo FH",       "Белый", "Превышение скорости", 70, "ул. Сарайшик, пересечение с ул. Акмешитоле би",   "192.168.1.2"),
    mkEvent("v4",  "406ADX11",   70,  "ЛУ 63 Туркестанская область, район Сауран, село Шорнак", "ЛУ 063","трасса м-32 Шымкент-Самара, пешеходный пе...",    "#252830", "#333a44", "10:05", "01.01.2024, 10:05", "Легковой", "Toyota Camry",   "Белый", "Превышение скорости", 60, "Туркестанская обл., р-н Сауран, с. Шорнак, трасса м-32", "192.168.1.3"),
    mkEvent("v5",  "313BAD02",   89,  "от ул. Бейімбет Майлин в сторону ул. Турара Рыску...", "ЛУ 130", "ул. Кабанбай батыр, остановка «Дачный м...",       "#e07c34", "#e07c34", "10:22", "01.01.2024, 10:22", "Легковой", "Toyota Camry",   "Белый", "Превышение скорости", 60, "от ул. Бейімбет Майлин в сторону ул. Турара Рыскулова","192.168.1.1"),
    mkEvent("v6",  "219BBK13",   89,  "ул. Сарайшик, пересечение с ул. Акмешитоле би",        "ЛУ 130", "ул. Сарайшик, пересечение с ул. Акмешит...",       "#d0d8e4", "#dde4ec", "10:44", "01.01.2024, 10:44", "Грузовой", "Volvo FH",       "Белый", "Превышение скорости", 70, "ул. Сарайшик, пересечение с ул. Акмешитоле би",   "192.168.1.2"),
    mkEvent("v7",  "406ADX11",   76,  "ЛУ 63 Туркестанская область, район Сауран, село Шорнак", "ЛУ 063","трасса м-32 Шымкент-Самара, пешеходный пе...",    "#252830", "#333a44", "11:10", "01.01.2024, 11:10", "Легковой", "Toyota Camry",   "Белый", "Превышение скорости", 60, "Туркестанская обл., р-н Сауран, с. Шорнак, трасса м-32", "192.168.1.3"),
    mkEvent("v8",  "372AIR11",   89,  "ул. Достык в сторону пр. Мангилик Ел, район Байте...", "ЛУ 130", "ул. Кабанбай батыр, остановка «Дачный м...",       "#c8d4dc", "#d5e0e8", "11:35", "01.01.2024, 11:35", "Легковой", "Toyota Camry",   "Белый", "Превышение скорости", 60, "ул. Dostyk в сторону пр. Мангилик Ел, Байтерека",  "192.168.1.1"),
    mkEvent("v9",  "406ADX11",   72,  "ЛУ 63 Туркестанская область — ночная съёмка",           "ЛУ 063", "трасса м-32, ночная съёмка",                        "#111418", "#1a2030", "23:50", "01.01.2024, 23:50", "Легковой", "Toyota Camry",   "Белый", "Превышение скорости", 60, "Туркестанская обл., трасса м-32, ночная съёмка",   "192.168.1.3"),
    mkEvent("v10", "777CAM01",   65,  "пр. Аль-Фараби в сторону ул. Достык...",                "ЛУ 204", "пр. Аль-Фараби, пересечение",                       "#c8d4dc", "#d5e0e8", "12:01", "01.01.2024, 12:01", "Легковой", "Toyota Camry",   "Белый", "Превышение скорости", 60, "пр. Аль-Фараби в сторону ул. Достык",              "192.168.1.4"),
];

// Messages for the heatmap flow
const HEATMAP_MESSAGES: ChatMessage[] = [
    { id: "1", role: "ai-text", time: "2 мин назад", text: "Я помощник Sergek, чем могу помочь?" },
    { id: "2", role: "user", time: "3 мин назад", text: "Покажи тепловую карту ДТП за последний месяц" },
    { id: "3", role: "ai-heatmap", time: "минуту назад" },
];

// Messages for the visual-search flow
const VISUAL_SEARCH_MESSAGES: ChatMessage[] = [
    { id: "1", role: "ai-text", time: "2 мин назад", text: "Я помощник Sergek, чем могу помочь?" },
    { id: "2", role: "user", time: "3 мин назад", text: "Найди белую Камри по городу за последние сутки" },
    { id: "3", role: "ai-visual-search", time: "минуту назад", count: 15, description: "белый Toyota Camry", dateRange: "01.01.2024 00:00 – 02.01.2024 23:59" },
];

// Camera positions [x%, y%] relative to map container
const CAMERAS = [
    { x: 28, y: 36 }, { x: 46, y: 42 }, { x: 33, y: 50 },
    { x: 48, y: 64 }, { x: 34, y: 64 }, { x: 63, y: 64 },
    { x: 75, y: 64 }, { x: 64, y: 78 }, { x: 35, y: 86 },
    { x: 54, y: 78 }, { x: 87, y: 17 }, { x: 70, y: 17 },
    { x: 20, y: 52 }, { x: 93, y: 54 }, { x: 88, y: 85 },
];

const RED_DOTS = [
    { x: 56, y: 45 }, { x: 34, y: 53 }, { x: 59, y: 58 },
];

// Route polyline for the vehicle path
const ROUTE = "28,50 46,50 76,50 76,36 70,36 63,50 63,64 48,64 48,78 63,78";

// ─── Map placeholder ──────────────────────────────────────────────────────────

const CameraMarker = ({ x, y }: { x: number; y: number }) => (
    <g transform={`translate(${x * 8},${y * 11})`}>
        <circle r="11" fill="#1e3a6e" stroke="white" strokeWidth="1.5" />
        <rect x="-5" y="-3.5" width="8" height="6" rx="1" fill="white" />
        <polygon points="3,-3 7,-5 7,5 3,4" fill="white" />
    </g>
);

const RedCross = ({ x, y }: { x: number; y: number }) => (
    <g transform={`translate(${x * 8},${y * 11})`}>
        <circle r="9" fill="#dc2626" />
        <line x1="0" y1="-5" x2="0" y2="5" stroke="white" strokeWidth="2" />
        <line x1="-5" y1="0" x2="5" y2="0" stroke="white" strokeWidth="2" />
    </g>
);

const HEATMAP_BLOBS = [
    { cx: 380, cy: 462, rx: 90, ry: 75, color: "#ef4444", opacity: 0.55 },
    { cx: 510, cy: 330, rx: 70, ry: 60, color: "#f97316", opacity: 0.42 },
    { cx: 250, cy: 550, rx: 65, ry: 55, color: "#f97316", opacity: 0.38 },
    { cx: 640, cy: 660, rx: 55, ry: 50, color: "#eab308", opacity: 0.32 },
    { cx: 130, cy: 385, rx: 50, ry: 45, color: "#eab308", opacity: 0.28 },
    { cx: 755, cy: 495, rx: 45, ry: 40, color: "#22c55e", opacity: 0.22 },
    { cx: 510, cy: 627, rx: 40, ry: 35, color: "#22c55e", opacity: 0.20 },
];

const MapSvg = ({ showRoute, highlightForecast, showHeatmap }: { showRoute: boolean; highlightForecast: boolean; showHeatmap?: boolean }) => (
    <svg
        viewBox="0 0 800 1100"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
    >
        {/* Streets - horizontal */}
        {[130, 300, 450, 560, 680, 760, 870, 980].map((y, i) => (
            <line key={`h${i}`} x1="0" y1={y} x2="800" y2={y} stroke="#c9bfa8" strokeWidth={i % 2 === 0 ? 12 : 7} />
        ))}
        {/* Streets - vertical */}
        {[120, 250, 380, 510, 640, 755].map((x, i) => (
            <line key={`v${i}`} x1={x} y1="0" x2={x} y2="1100" stroke="#c9bfa8" strokeWidth={i % 2 === 0 ? 9 : 13} />
        ))}
        {/* City blocks */}
        {[
            [130, 140, 110, 150], [260, 140, 110, 150], [390, 140, 110, 150], [520, 140, 110, 150], [655, 140, 90, 150],
            [130, 310, 110, 130], [260, 310, 110, 130], [390, 310, 110, 130], [520, 310, 110, 130], [655, 310, 90, 130],
            [130, 460, 110, 90], [260, 460, 110, 90], [390, 460, 110, 90], [520, 460, 110, 90], [655, 460, 90, 90],
            [130, 570, 110, 100], [260, 570, 110, 100], [390, 570, 110, 100], [520, 570, 110, 100],
            [130, 690, 110, 60], [260, 690, 110, 60], [390, 690, 110, 60], [520, 690, 110, 60], [655, 690, 90, 60],
            [130, 770, 110, 90], [260, 770, 110, 90], [390, 770, 110, 90], [520, 770, 110, 90], [655, 770, 90, 90],
            [130, 880, 110, 90], [260, 880, 110, 90], [390, 880, 110, 90], [520, 880, 110, 90], [655, 880, 90, 90],
        ].map(([x, y, w, h], i) => (
            <rect key={`b${i}`} x={x} y={y} width={w} height={h} fill="#d5ccbb" rx="2" />
        ))}
        {/* Parks */}
        <rect x="390" y="310" width="110" height="130" fill="#b8d4a8" rx="2" />
        <rect x="655" y="570" width="90" height="100" fill="#b8d4a8" rx="2" />
        {/* Route */}
        {showRoute && (
            <polyline
                points={ROUTE.split(" ").map((p) => p.split(",").map((v, i) => Number(v) * (i === 0 ? 8 : 11)).join(",")).join(" ")}
                fill="none"
                stroke="#1e3a6e"
                strokeWidth="5"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        )}
        {/* Camera markers */}
        {CAMERAS.map((c, i) => (
            <CameraMarker key={i} x={c.x} y={c.y} />
        ))}
        {/* Red cross markers */}
        {RED_DOTS.map((d, i) => (
            <RedCross key={i} x={d.x} y={d.y} />
        ))}
        {/* Forecast pulsing marker */}
        {highlightForecast && (
            <circle cx={46 * 8} cy={42 * 11} r="18" fill="none" stroke="#1e3a6e" strokeWidth="3" opacity="0.6" />
        )}
        {/* Heatmap blobs */}
        {showHeatmap && (
            <g style={{ mixBlendMode: "multiply" }}>
                {HEATMAP_BLOBS.map((b, i) => (
                    <ellipse key={i} cx={b.cx} cy={b.cy} rx={b.rx * 2.5} ry={b.ry * 2.5} fill={b.color} opacity={b.opacity} />
                ))}
            </g>
        )}
        {/* Number badge on camera with 8 */}
        <circle cx={20 * 8} cy={52 * 11} r="11" fill="#1e3a6e" stroke="white" strokeWidth="1.5" />
        <rect x={20 * 8 - 5} y={52 * 11 - 3.5} width="8" height="6" rx="1" fill="white" />
        <polygon points={`${20 * 8 + 3},${52 * 11 - 3} ${20 * 8 + 7},${52 * 11 - 5} ${20 * 8 + 7},${52 * 11 + 5} ${20 * 8 + 3},${52 * 11 + 4}`} fill="white" />
        <circle cx={20 * 8 + 12} cy={52 * 11 - 11} r="7" fill="#dc2626" />
        <text x={20 * 8 + 12} y={52 * 11 - 8} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">8</text>
    </svg>
);

// ─── AI avatar ────────────────────────────────────────────────────────────────

const AiAvatar = () => (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-solid">
        {/* Sparkle icon using SVG since we use a custom shape */}
        <svg viewBox="0 0 16 16" className="size-4 fill-white" aria-hidden="true">
            <path d="M8 1 L9 6 L14 7 L9 8 L8 13 L7 8 L2 7 L7 6 Z" />
        </svg>
    </div>
);

// ─── Message components ───────────────────────────────────────────────────────

const AiTextBubble = ({ msg }: { msg: AiTextMsg }) => (
    <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
            <AiAvatar />
            <span className="text-sm font-semibold text-primary">sergek ai</span>
            <span className="ml-auto text-xs text-tertiary">{msg.time}</span>
        </div>
        <div className="ml-10 max-w-[400px] rounded-2xl rounded-tl-sm bg-primary px-4 py-3 shadow-sm">
            <p className="text-sm text-primary">{msg.text}</p>
        </div>
    </div>
);

const UserBubble = ({ msg }: { msg: UserMsg }) => (
    <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-primary">Вы</span>
            <span className="text-xs text-tertiary">{msg.time}</span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-solid">
                <span className="text-xs font-semibold text-white">А</span>
            </div>
        </div>
        <div className="mr-10 max-w-[400px] rounded-2xl rounded-tr-sm bg-brand-solid px-4 py-3">
            <p className="text-sm text-white">{msg.text}</p>
        </div>
    </div>
);

// ─── Report files bubble ──────────────────────────────────────────────────────

const DownloadIcon = () => (
    <svg viewBox="0 0 20 20" className="size-5 shrink-0 text-fg-tertiary" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M10 3v9m0 0l-3-3m3 3l3-3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 14v1a2 2 0 002 2h8a2 2 0 002-2v-1" strokeLinecap="round" />
    </svg>
);

const ReportFileCard = ({ title, location, size }: { title: string; location: string; size: string }) => (
    <button
        type="button"
        className="flex w-full items-center gap-3 rounded-xl border border-secondary bg-primary px-4 py-3 text-left shadow-xs transition duration-100 ease-linear hover:bg-secondary_hover hover:shadow-sm"
    >
        <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-primary">{title}</p>
            <p className="mt-0.5 text-xs text-tertiary">{location} · {size}</p>
        </div>
        <DownloadIcon />
    </button>
);

const AiReportsBubble = ({ msg }: { msg: AiReportsMsg }) => (
    <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
            <AiAvatar />
            <span className="text-sm font-semibold text-primary">sergek ai</span>
            <span className="ml-auto text-xs text-tertiary">{msg.time}</span>
        </div>
        <div className="ml-10 flex max-w-sm flex-col gap-2">
            {msg.reports.map((r, i) => (
                <ReportFileCard key={i} {...r} />
            ))}
        </div>
    </div>
);

// ─── Video bubble ─────────────────────────────────────────────────────────────

const VideoPlaceholder = ({ label, currentTime, remaining }: { label: string; currentTime: string; remaining: string }) => (
    <div className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
        {/* Video area */}
        <div className="relative" style={{ aspectRatio: "16/9", background: "#1a1f2e" }}>
            {/* Simulated camera feed with detection boxes */}
            <svg viewBox="0 0 320 180" className="absolute inset-0 h-full w-full" aria-hidden="true">
                {/* Road / ground */}
                <rect width="320" height="180" fill="#2d3142" />
                {/* Lane markings */}
                <line x1="160" y1="0" x2="140" y2="180" stroke="#888" strokeWidth="1" strokeDasharray="12 8" opacity="0.4" />
                {/* Car 1 - silver */}
                <rect x="60" y="60" width="90" height="60" rx="6" fill="#8a9ab0" />
                <rect x="70" y="50" width="70" height="35" rx="4" fill="#7a8a9f" />
                <ellipse cx="75" cy="122" rx="12" ry="12" fill="#222" /><ellipse cx="75" cy="122" rx="7" ry="7" fill="#555" />
                <ellipse cx="137" cy="122" rx="12" ry="12" fill="#222" /><ellipse cx="137" cy="122" rx="7" ry="7" fill="#555" />
                {/* Car 1 detection box (yellow) */}
                <rect x="55" y="45" width="102" height="82" rx="2" fill="none" stroke="#f5c518" strokeWidth="1.5" />
                {/* Label */}
                <rect x="55" y="45" width="64" height="14" rx="2" fill="#22c55e" />
                <text x="59" y="55" fill="white" fontSize="7" fontFamily="monospace">ИНОСТР. ТС</text>
                {/* Car 2 - white */}
                <rect x="200" y="30" width="80" height="50" rx="5" fill="#d0d8e4" />
                <rect x="207" y="22" width="62" height="30" rx="3" fill="#c0c8d4" />
                <ellipse cx="213" cy="82" rx="10" ry="10" fill="#222" /><ellipse cx="213" cy="82" rx="6" ry="6" fill="#555" />
                <ellipse cx="268" cy="82" rx="10" ry="10" fill="#222" /><ellipse cx="268" cy="82" rx="6" ry="6" fill="#555" />
                {/* Detection lines */}
                <line x1="0" y1="140" x2="320" y2="100" stroke="#06b6d4" strokeWidth="1" opacity="0.6" />
                <line x1="0" y1="160" x2="320" y2="120" stroke="#f97316" strokeWidth="1" opacity="0.5" />
                <line x1="30" y1="0" x2="10" y2="180" stroke="#a855f7" strokeWidth="1" opacity="0.5" />
                <line x1="260" y1="0" x2="300" y2="180" stroke="#ef4444" strokeWidth="1" opacity="0.4" />
            </svg>

            {/* Label top-left */}
            <div className="absolute top-3 left-3 rounded-md bg-black/50 px-2 py-1">
                <span className="text-xs font-medium text-white">{label}</span>
            </div>

            {/* Play button */}
            <button
                type="button"
                className="absolute inset-0 flex items-center justify-center"
                aria-label="Воспроизвести"
            >
                <div className="flex size-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition duration-100 ease-linear hover:bg-white hover:scale-105">
                    <svg viewBox="0 0 20 20" className="size-5 translate-x-0.5 fill-primary" aria-hidden="true">
                        <path d="M6.3 3.3A1 1 0 005 4.2v11.6a1 1 0 001.5.86l9.5-5.8a1 1 0 000-1.72L6.5 3.3z" />
                    </svg>
                </div>
            </button>

            {/* Progress bar */}
            <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-6 pb-2.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{currentTime}</span>
                    <div className="relative flex-1">
                        <div className="h-1 overflow-hidden rounded-full bg-white/30">
                            <div className="h-full w-[31%] rounded-full bg-brand-solid" />
                        </div>
                        <div className="absolute top-1/2 left-[31%] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow" />
                    </div>
                    <span className="text-xs font-medium text-white/70">{remaining}</span>
                </div>
            </div>
        </div>

        {/* Footer with archive link */}
        <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-sm text-tertiary">Запрос обработан.</span>
            <Button size="sm" color="secondary" href="#" className="gap-1.5">
                <svg viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current" strokeWidth="1.5" aria-hidden="true">
                    <path d="M8 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V8" strokeLinecap="round" />
                    <path d="M10 2h4v4M14 2L8 8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Посмотреть тут
            </Button>
        </div>
    </div>
);

const AiVideoBubble = ({ msg }: { msg: AiVideoMsg }) => (
    <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
            <AiAvatar />
            <span className="text-sm font-semibold text-primary">sergek ai</span>
            <span className="ml-auto text-xs text-tertiary">{msg.time}</span>
        </div>
        <div className="ml-10 max-w-sm">
            <VideoPlaceholder label={msg.label} currentTime={msg.currentTime} remaining={msg.remaining} />
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────

const SearchResultCard = ({ msg, onViewMap }: { msg: AiSearchResultMsg; onViewMap: () => void }) => (
    <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
            <AiAvatar />
            <span className="text-sm font-semibold text-primary">sergek ai</span>
            <span className="ml-auto text-xs text-tertiary">{msg.time}</span>
        </div>
        <div className="ml-10 max-w-[480px] overflow-hidden rounded-2xl rounded-tl-sm border border-secondary bg-primary shadow-sm">
            <div className="px-4 pt-4 pb-3">
                <p className="text-sm font-semibold text-primary">Запрос обработан</p>
                <p className="mt-2 text-sm text-primary">
                    Найден{" "}
                    <span className="font-bold text-brand-secondary">{msg.plate}</span>{" "}
                    последний раз был замечен
                </p>
                <p className="mt-1 text-sm text-primary">
                    {msg.address} Составил историю движения данного автомобиля, чтобы перейти — нажмите на карту
                </p>
                <p className="mt-2 text-xs text-tertiary">
                    Отображен маршрут последних {msg.shown} из {msg.total} фиксаций за выбранный период.
                </p>
            </div>

            {/* Map thumbnail */}
            <div
                className="relative mx-4 mb-3 overflow-hidden rounded-xl"
                style={{ height: 160, background: "#e8dcc8" }}
                onClick={onViewMap}
                role="button"
                tabIndex={0}
                aria-label="Открыть карту"
            >
                <MapSvg showRoute={true} highlightForecast={false} />
                <div className="absolute inset-0 cursor-pointer bg-transparent" />
            </div>

            <div className="px-4 pb-4">
                <Button size="md" color="primary" className="w-full" onClick={onViewMap}>
                    Посмотреть на карте
                </Button>
            </div>
        </div>
    </div>
);

// ─── Forecast popup ───────────────────────────────────────────────────────────

const ForecastPopup = ({ onClose, onShowList }: { onClose: () => void; onShowList: () => void }) => (
    <div
        className="absolute z-20 w-72 overflow-hidden rounded-2xl border border-secondary bg-primary shadow-xl"
        style={{ top: "30%", left: "30%" }}
    >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-sm font-semibold text-primary">Прогнозируемая точка</span>
            <button type="button" onClick={onClose} className="text-fg-tertiary transition duration-100 ease-linear hover:text-fg-primary">
                <XClose className="size-4" />
            </button>
        </div>
        <div className="px-4 pb-3">
            <p className="text-sm text-secondary">Лу 70 пр. Тауелсіздік - ул. Ақыртас (2)</p>
        </div>
        <div className="border-t border-secondary px-4 py-3">
            <Button size="sm" color="primary" className="w-full" onClick={onShowList}>
                Посмотреть список
            </Button>
        </div>
    </div>
);

// ─── Events list sheet ────────────────────────────────────────────────────────

// ─── Events panel (permanent bottom panel below map) ─────────────────────────

// ─── Visual search result card ────────────────────────────────────────────────

const AiVisualSearchBubble = ({ msg, onViewMap }: { msg: AiVisualSearchMsg; onViewMap: () => void }) => (
    <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
            <AiAvatar />
            <span className="text-sm font-semibold text-primary">sergek ai</span>
            <span className="ml-auto text-xs text-tertiary">{msg.time}</span>
        </div>
        <div className="ml-10 max-w-[480px] overflow-hidden rounded-2xl rounded-tl-sm border border-secondary bg-primary shadow-sm">
            <div className="px-4 pt-4 pb-3">
                <p className="text-sm font-semibold text-primary">Запрос обработан</p>
                <p className="mt-2 text-sm text-primary">
                    Найдены{" "}
                    <span className="font-bold text-brand-secondary">{msg.count} ТС {msg.description}</span>
                </p>
                <p className="mt-1 text-sm text-primary">
                    за {msg.dateRange}, составил историю событий этих автомобилей, чтобы просмотреть — перейдите на карту
                </p>
            </div>
            <div className="relative mx-4 mb-3 cursor-pointer overflow-hidden rounded-xl" style={{ height: 160, background: "#e8dcc8" }} onClick={onViewMap} role="button" tabIndex={0}>
                <MapSvg showRoute={false} highlightForecast={false} />
                <div className="absolute inset-0" />
            </div>
            <div className="px-4 pb-4">
                <Button size="md" color="primary" className="w-full" onClick={onViewMap}>Посмотреть на карте</Button>
            </div>
        </div>
    </div>
);

// ─── Event detail panel ───────────────────────────────────────────────────────

const PlateImage = ({ plate }: { plate: string }) => (
    <div className="inline-flex items-center gap-1.5 rounded-md border-2 border-fg-primary bg-primary px-2 py-1">
        <div className="flex h-5 w-3 items-center justify-center rounded-sm bg-brand-solid">
            <span className="text-[7px] font-bold leading-none text-white">KZ</span>
        </div>
        <span className="font-mono text-sm font-bold tracking-wider text-primary">{plate}</span>
    </div>
);

const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[140px_1fr] items-start gap-3 py-3">
        <span className="text-sm text-tertiary">{label}:</span>
        <div>{children}</div>
    </div>
);

const VehiclePhoto = ({ carColor }: { carColor: string }) => (
    <div className="relative h-52 w-full overflow-hidden rounded-xl bg-stone-300">
        {/* Road surface */}
        <svg viewBox="0 0 400 210" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {/* Road */}
            <rect width="400" height="210" fill="#888" />
            <rect y="100" width="400" height="110" fill="#777" />
            {/* Lane markings */}
            <rect x="190" y="105" width="20" height="4" fill="white" opacity="0.8" />
            <rect x="190" y="120" width="20" height="4" fill="white" opacity="0.8" />
            <rect x="190" y="135" width="20" height="4" fill="white" opacity="0.8" />
            {/* Truck (left) - top-down view */}
            <rect x="20" y="60" width="55" height="120" rx="4" fill="#dde8ee" />
            <rect x="20" y="60" width="55" height="40" rx="3" fill="#b8ccd8" />
            <rect x="28" y="62" width="38" height="18" rx="2" fill="#9ab4c4" opacity="0.7" />
            <ellipse cx="27" cy="68" rx="8" ry="8" fill="#222" /><ellipse cx="27" cy="68" rx="4" ry="4" fill="#555" />
            <ellipse cx="68" cy="68" rx="8" ry="8" fill="#222" /><ellipse cx="68" cy="68" rx="4" ry="4" fill="#555" />
            <ellipse cx="27" cy="172" rx="8" ry="8" fill="#222" /><ellipse cx="27" cy="172" rx="4" ry="4" fill="#555" />
            <ellipse cx="68" cy="172" rx="8" ry="8" fill="#222" /><ellipse cx="68" cy="172" rx="4" ry="4" fill="#555" />
            {/* White Camry (right) - top-down view */}
            <rect x="210" y="108" width="70" height="95" rx="8" fill={carColor} />
            <rect x="216" y="114" width="58" height="40" rx="4" fill={carColor} opacity="0.9" />
            <rect x="220" y="118" width="50" height="28" rx="2" fill="#b8d0e4" opacity="0.7" />
            <ellipse cx="217" cy="116" rx="9" ry="9" fill="#222" /><ellipse cx="217" cy="116" rx="5" ry="5" fill="#555" />
            <ellipse cx="273" cy="116" rx="9" ry="9" fill="#222" /><ellipse cx="273" cy="116" rx="5" ry="5" fill="#555" />
            <ellipse cx="217" cy="194" rx="9" ry="9" fill="#222" /><ellipse cx="217" cy="194" rx="5" ry="5" fill="#555" />
            <ellipse cx="273" cy="194" rx="9" ry="9" fill="#222" /><ellipse cx="273" cy="194" rx="5" ry="5" fill="#555" />
            {/* Plate on Camry */}
            <rect x="228" y="188" width="34" height="10" rx="1" fill="#eee" />
            <text x="231" y="196" fill="#222" fontSize="5" fontFamily="monospace" fontWeight="bold">372AIR11</text>
        </svg>
        {/* Fullscreen hint */}
        <button type="button" className="absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-md bg-black/50 text-white transition duration-100 ease-linear hover:bg-black/70" aria-label="На весь экран">
            <svg viewBox="0 0 14 14" className="size-3.5 fill-none stroke-current" strokeWidth="1.5" aria-hidden="true">
                <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </button>
    </div>
);

const EventDetailPanel = ({ event, onClose }: { event: EventItem; onClose: () => void }) => (
    <div className="flex w-[360px] shrink-0 flex-col overflow-hidden border-l border-secondary bg-primary">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-secondary px-4 py-3">
            <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-fg-tertiary transition duration-100 ease-linear hover:bg-secondary_hover hover:text-fg-primary" aria-label="Назад">
                <ArrowLeft className="size-4" />
            </button>
            <span className="flex-1 text-sm font-semibold text-primary">Информация о транспортном средстве</span>
            <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-fg-tertiary transition duration-100 ease-linear hover:bg-secondary_hover hover:text-fg-primary" aria-label="Закрыть">
                <XClose className="size-4" />
            </button>
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <VehiclePhoto carColor={event.carColor} />

            <div className="mt-4 divide-y divide-secondary">
                <DetailRow label="Дата и время">{event.datetime}</DetailRow>
                <DetailRow label="ГРНЗ автотранспорта">
                    <div className="flex flex-col gap-1.5">
                        <PlateImage plate={event.plate.replace(/\s/g, "")} />
                        <span className="text-sm font-semibold text-primary">{event.plate}</span>
                    </div>
                </DetailRow>
                <DetailRow label="Тип ТС">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary">
                        <svg viewBox="0 0 14 10" className="size-3.5 fill-current" aria-hidden="true">
                            <rect x="1" y="3" width="12" height="6" rx="2" /><rect x="3" y="1" width="8" height="4" rx="1" />
                            <circle cx="3.5" cy="9" r="1.5" /><circle cx="10.5" cy="9" r="1.5" />
                        </svg>
                        {event.vehicleType}
                    </span>
                </DetailRow>
                <DetailRow label="Марка/модель ТС"><span className="text-sm text-primary">{event.make}</span></DetailRow>
                <DetailRow label="Цвет ТС"><span className="text-sm text-primary">{event.color}</span></DetailRow>
                <DetailRow label="Тип нарушения">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary">
                        <svg viewBox="0 0 14 14" className="size-3.5 fill-none stroke-current" strokeWidth="1.5" aria-hidden="true">
                            <circle cx="7" cy="7" r="6" /><path d="M7 7L9.5 4.5" strokeLinecap="round" /><circle cx="7" cy="7" r="1" fill="currentColor" />
                        </svg>
                        {event.violation}
                    </span>
                </DetailRow>
                <DetailRow label="Скорость"><SpeedBadge speed={event.speed} /></DetailRow>
                <DetailRow label="Разрешённая скорость"><span className="text-sm text-primary">{event.allowedSpeed} км/ч</span></DetailRow>
                <DetailRow label="Локация"><span className="text-sm text-primary">{event.location}</span></DetailRow>
                <DetailRow label="Направление движения"><span className="text-sm text-primary">{event.direction.replace("...", "")}</span></DetailRow>
                <DetailRow label="Камера"><span className="text-sm font-mono font-semibold text-primary">{event.cameraIp}</span></DetailRow>
            </div>
        </div>
    </div>
);

const CarPhoto = ({ bg }: { bg: string }) => (
    <div className="relative h-[72px] w-[108px] shrink-0 overflow-hidden rounded-xl" style={{ background: bg }}>
        {/* Road */}
        <div className="absolute bottom-0 left-0 right-0 h-6 opacity-30" style={{ background: "#555" }} />
        <div className="absolute bottom-2.5 left-0 right-0 h-px" style={{ background: "#fff" }} />
        {/* Car silhouette */}
        <svg viewBox="0 0 80 40" className="absolute inset-0 m-auto w-16 fill-white opacity-85" aria-hidden="true">
            <rect x="6" y="18" width="68" height="16" rx="4" />
            <rect x="16" y="8" width="48" height="15" rx="3" />
            <ellipse cx="20" cy="34" rx="6" ry="6" />
            <ellipse cx="60" cy="34" rx="6" ry="6" />
            <ellipse cx="20" cy="34" rx="3" ry="3" fill={bg} />
            <ellipse cx="60" cy="34" rx="3" ry="3" fill={bg} />
            <rect x="18" y="10" width="18" height="10" rx="2" fill={bg} opacity="0.5" />
            <rect x="42" y="10" width="18" height="10" rx="2" fill={bg} opacity="0.5" />
        </svg>
    </div>
);

const SpeedBadge = ({ speed }: { speed: number }) => (
    <span className={cx(
        "ml-auto flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold",
        speed >= 100 ? "bg-error-secondary text-error-primary" : "bg-error-secondary text-error-primary",
    )}>
        {/* Speedometer icon */}
        <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 7L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7" cy="7" r="1" fill="currentColor" />
        </svg>
        {speed} км/ч
    </span>
);

const DirectionIcon = () => (
    <svg viewBox="0 0 14 14" className="mt-0.5 size-3.5 shrink-0 text-fg-brand-primary" fill="currentColor" aria-hidden="true">
        <path d="M7 0L9.5 4H11L7 0 3 4H4.5L7 0Z" />
        <rect x="6" y="2" width="2" height="10" rx="1" />
        <path d="M4 10H2L4 14H10L12 10H10" />
    </svg>
);

const PinIcon = () => (
    <svg viewBox="0 0 12 16" className="mt-0.5 size-3 shrink-0 text-fg-brand-primary" fill="currentColor" aria-hidden="true">
        <path d="M6 0C3.2 0 1 2.2 1 5c0 3.9 5 11 5 11s5-7.1 5-11C11 2.2 8.8 0 6 0zm0 7.5C4.6 7.5 3.5 6.4 3.5 5S4.6 2.5 6 2.5 8.5 3.6 8.5 5 7.4 7.5 6 7.5z" />
    </svg>
);

const EventRow = ({ ev, isSelected, onSelect }: { ev: EventItem; isSelected: boolean; onSelect: () => void }) => (
    <div
        onClick={onSelect}
        className={cx(
            "flex cursor-pointer items-start gap-4 px-5 py-3.5 transition duration-100 ease-linear",
            isSelected ? "bg-brand-primary_alt border-l-2 border-brand" : "hover:bg-secondary border-l-2 border-transparent",
        )}
    >
        <CarPhoto bg={ev.carBg} />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {/* Plate + speed */}
            <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-wide text-primary">{ev.plate}</span>
                <SpeedBadge speed={ev.speed} />
            </div>

            {/* Direction */}
            <div className="flex items-start gap-2">
                <DirectionIcon />
                <span className="truncate text-xs text-tertiary">{ev.direction}</span>
            </div>

            {/* Camera */}
            <div className="flex items-start gap-2">
                <PinIcon />
                <div className="flex min-w-0 items-center gap-1.5 text-xs">
                    <span className="shrink-0 rounded-md bg-brand-secondary px-1.5 py-0.5 font-semibold text-brand-primary">
                        {ev.camera}
                    </span>
                    <span className="truncate text-tertiary">{ev.cameraAddress}</span>
                </div>
            </div>
        </div>

        {/* Time */}
        <span className="shrink-0 pt-0.5 text-xs text-quaternary">{ev.time}</span>
    </div>
);

const EventsPanel = ({
    events,
    subtitle,
    selectedId,
    onSelect,
}: {
    events: EventItem[];
    subtitle: string;
    selectedId: string | null;
    onSelect: (id: string) => void;
}) => (
    <div className="flex shrink-0 flex-col border-t border-secondary bg-primary" style={{ height: "42%" }}>
        <div className="flex shrink-0 items-center justify-between border-b border-secondary px-5 py-3">
            <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold text-primary">Список событий</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary">{events.length}</span>
            </div>
            <span className="text-xs text-tertiary">{subtitle}</span>
        </div>
        <div className="min-h-0 flex-1 divide-y divide-secondary overflow-y-auto">
            {events.map((ev) => (
                <EventRow key={ev.id} ev={ev} isSelected={selectedId === ev.id} onSelect={() => onSelect(ev.id)} />
            ))}
        </div>
    </div>
);

// ─── Heatmap overlays ─────────────────────────────────────────────────────────

const HeatmapLegend = () => (
    <div className="absolute bottom-4 left-4 z-10 overflow-hidden rounded-xl shadow-xl" style={{ background: "rgba(20,24,36,0.92)", border: "1px solid #2a3048" }}>
        <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
                <svg viewBox="0 0 14 14" className="size-3.5 fill-none stroke-current" strokeWidth="1.5" style={{ color: "#ef4444" }} aria-hidden="true">
                    <circle cx="7" cy="7" r="6" />
                    <path d="M4 10c.5-2 1.5-3 3-4" strokeLinecap="round" />
                    <circle cx="9" cy="5" r="1" fill="#ef4444" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#e2e8f0" }}>Нарушения</span>
            </div>
            {/* Gradient bar */}
            <div className="mt-2 h-2 w-40 rounded-full" style={{ background: "linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)" }} />
            <div className="mt-1 flex justify-between">
                <span className="text-[10px]" style={{ color: "#64748b" }}>Низкая</span>
                <span className="text-[10px]" style={{ color: "#64748b" }}>Высокая</span>
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: "#475569" }}>событий/км²</div>
        </div>
        <div className="flex items-center gap-1.5 border-t px-4 py-2" style={{ borderColor: "#2a3048" }}>
            <span className="size-2 rounded-full" style={{ background: "#22c55e" }} />
            <span className="text-[10px] font-medium" style={{ color: "#94a3b8" }}>Live (15 мин)</span>
        </div>
    </div>
);

const HeatmapControlPanel = () => {
    const [period, setPeriod] = useState<"live" | "today" | "yesterday" | "week" | "month">("month");
    const [opacity, setOpacity] = useState(60);
    const [basemap, setBasemap] = useState<"scheme" | "satellite" | "3d">("scheme");

    return (
        <div className="absolute top-4 right-4 z-10 w-64 overflow-hidden rounded-2xl shadow-xl" style={{ background: "rgba(20,24,36,0.95)", border: "1px solid #2a3048" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #2a3048" }}>
                <div className="flex items-center gap-2">
                    <svg viewBox="0 0 14 14" className="size-4 fill-none stroke-current" strokeWidth="1.5" style={{ color: "#ef4444" }} aria-hidden="true">
                        <circle cx="7" cy="7" r="6" />
                        <path d="M4 10c.5-2 1.5-3 3-4" strokeLinecap="round" />
                        <circle cx="9" cy="5" r="1" fill="#ef4444" />
                    </svg>
                    <span className="text-sm font-bold uppercase tracking-widest" style={{ color: "#e2e8f0" }}>Тепловая карта</span>
                </div>
                <svg viewBox="0 0 12 12" className="size-3.5 fill-none stroke-current" strokeWidth="1.5" style={{ color: "#64748b" }} aria-hidden="true">
                    <path d="M2 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>

            <div className="p-4 flex flex-col gap-4">
                {/* Tab */}
                <button type="button" className="flex items-center gap-2 self-start rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                    <svg viewBox="0 0 12 12" className="size-3 fill-none stroke-current" strokeWidth="1.5" aria-hidden="true">
                        <circle cx="6" cy="6" r="5" />
                        <path d="M3.5 8.5c.4-1.5 1.2-2.5 2.5-3.5" strokeLinecap="round" />
                        <circle cx="7.5" cy="4" r="0.8" fill="#f87171" />
                    </svg>
                    Нарушения
                </button>

                {/* Period */}
                <div>
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#475569" }}>
                        <svg viewBox="0 0 12 12" className="size-3 fill-none stroke-current" strokeWidth="1.5" aria-hidden="true">
                            <circle cx="6" cy="6" r="5" /><path d="M6 3v3l2 1.5" strokeLinecap="round" />
                        </svg>
                        Период
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1.5">
                            {(["live", "today", "yesterday"] as const).map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPeriod(p)}
                                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition duration-100 ease-linear"
                                    style={period === p
                                        ? { background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155" }
                                        : { background: "transparent", color: "#64748b", border: "1px solid #1e293b" }
                                    }
                                >
                                    {p === "live" && <span className="size-1.5 rounded-full" style={{ background: "#22c55e" }} />}
                                    {p === "live" ? "Live" : p === "today" ? "Сегодня" : "Вчера"}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-1.5">
                            {(["week", "month"] as const).map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPeriod(p)}
                                    className="flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition duration-100 ease-linear"
                                    style={period === p
                                        ? { background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155" }
                                        : { background: "transparent", color: "#64748b", border: "1px solid #1e293b" }
                                    }
                                >
                                    {p === "week" ? "Неделя" : "Месяц"}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Opacity */}
                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#475569" }}>Прозрачность</span>
                        <span className="text-xs font-semibold" style={{ color: "#94a3b8" }}>{opacity}%</span>
                    </div>
                    <div className="relative flex items-center">
                        <div className="h-1 w-full rounded-full" style={{ background: "#1e293b" }}>
                            <div className="h-full rounded-full" style={{ width: `${opacity}%`, background: "linear-gradient(to right, #334155, #22c55e)" }} />
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={opacity}
                            onChange={(e) => setOpacity(Number(e.target.value))}
                            className="absolute inset-0 w-full cursor-pointer opacity-0"
                            style={{ height: "16px" }}
                        />
                        <div className="pointer-events-none absolute size-4 rounded-full border-2 shadow" style={{ left: `calc(${opacity}% - 8px)`, background: "#22c55e", borderColor: "#fff" }} />
                    </div>
                </div>

                {/* Basemap */}
                <div>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#475569" }}>Подложка</div>
                    <div className="flex gap-1.5">
                        {(["scheme", "satellite", "3d"] as const).map((b) => (
                            <button
                                key={b}
                                type="button"
                                onClick={() => setBasemap(b)}
                                className="flex-1 rounded-lg py-1.5 text-xs font-medium transition duration-100 ease-linear"
                                style={basemap === b
                                    ? { background: "#e2e8f0", color: "#0f172a" }
                                    : { background: "transparent", color: "#64748b", border: "1px solid #1e293b" }
                                }
                            >
                                {b === "scheme" ? "Схема" : b === "satellite" ? "Спутник" : "3D"}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Heatmap chat bubble ───────────────────────────────────────────────────────

const HEATMAP_THUMBNAIL_MARKERS = [
    { x: 28, y: 38 }, { x: 43, y: 30 }, { x: 55, y: 45 }, { x: 68, y: 32 },
    { x: 18, y: 55 }, { x: 35, y: 62 }, { x: 52, y: 58 }, { x: 72, y: 60 },
    { x: 60, y: 70 }, { x: 30, y: 72 }, { x: 80, y: 48 }, { x: 45, y: 75 },
];
const HEATMAP_ACCIDENTS = [
    { x: 35, y: 52, red: true }, { x: 56, y: 38, red: false }, { x: 62, y: 62, red: true },
    { x: 25, y: 68, red: false }, { x: 70, y: 70, red: true }, { x: 82, y: 52, red: false },
];

const AiHeatmapBubble = ({ msg, onViewMap }: { msg: AiHeatmapMsg; onViewMap: () => void }) => (
    <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
            <AiAvatar />
            <span className="text-sm font-semibold text-primary">sergek ai</span>
            <span className="ml-auto text-xs text-tertiary">{msg.time}</span>
        </div>
        <div className="ml-10 max-w-[480px] overflow-hidden rounded-2xl rounded-tl-sm border border-secondary bg-primary shadow-sm">
            <div className="px-4 pt-4 pb-3">
                <p className="text-sm font-semibold text-primary">Запрос обработан</p>
                <p className="mt-2 text-sm text-primary">
                    Найдены все ДТП, зарегистрированные за период <span className="font-semibold">15.09 – 15.10</span> по городу Алматы.
                </p>
                <div className="mt-3 flex flex-col gap-1">
                    <p className="text-sm text-primary">
                        Количество за указанный период —{" "}
                        <span className="text-xl font-bold text-brand-secondary">18</span>
                    </p>
                    <p className="text-sm text-primary">
                        &bull; со смертельным исходом —{" "}
                        <span className="text-base font-bold text-brand-secondary">0</span>
                    </p>
                    <p className="text-sm text-primary">
                        &bull; с телесными повреждениями —{" "}
                        <span className="text-base font-bold text-brand-secondary">6</span>
                    </p>
                    <p className="text-sm text-primary">
                        &bull; с материальным ущербом —{" "}
                        <span className="text-base font-bold text-brand-secondary">12</span>
                    </p>
                </div>
                <p className="mt-3 text-sm text-primary">
                    Для удобства восприятия я составил тепловую карту с разбивкой по суткам по аварийным инцидентам.
                    Можете перейти на карту, нажав на кнопку ниже.
                </p>
            </div>

            {/* Map thumbnail */}
            <div
                className="relative mx-4 mb-3 cursor-pointer overflow-hidden rounded-xl"
                style={{ height: 180, background: "#e8dcc8" }}
                onClick={onViewMap}
                role="button"
                tabIndex={0}
                aria-label="Открыть карту"
            >
                <MapSvg showRoute={false} highlightForecast={false} showHeatmap={true} />
                {/* Car + cross markers overlay */}
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
                    {HEATMAP_THUMBNAIL_MARKERS.map((m, i) => (
                        <g key={i} transform={`translate(${m.x},${m.y})`}>
                            <circle r="4" fill="#1e3a6e" stroke="white" strokeWidth="0.8" />
                            <rect x="-2.5" y="-1.5" width="3.5" height="2.5" rx="0.5" fill="white" />
                            <polygon points="1,-1.5 3,-2 3,2 1,1.5" fill="white" />
                        </g>
                    ))}
                    {HEATMAP_ACCIDENTS.map((m, i) => (
                        <g key={i} transform={`translate(${m.x},${m.y})`}>
                            <circle r="3.5" fill={m.red ? "#dc2626" : "#1e3a6e"} stroke="white" strokeWidth="0.6" />
                            {m.red
                                ? <><line x1="0" y1="-2" x2="0" y2="2" stroke="white" strokeWidth="1" /><line x1="-2" y1="0" x2="2" y2="0" stroke="white" strokeWidth="1" /></>
                                : <><rect x="-1.5" y="-1" width="2.5" height="2" rx="0.4" fill="white" /><polygon points="1,-0.8 2.5,-1.5 2.5,1.5 1,0.8" fill="white" /></>
                            }
                        </g>
                    ))}
                </svg>
                <div className="absolute inset-0 bg-transparent" />
            </div>

            <div className="px-4 pb-4">
                <Button size="md" color="primary" className="w-full" onClick={onViewMap}>
                    Посмотреть на карте
                </Button>
            </div>
        </div>
    </div>
);

// ─── Map panel ────────────────────────────────────────────────────────────────

const MapPanel = ({
    overlay,
    onBack,
    onForecastClick,
    onCloseOverlay,
}: {
    overlay: MapOverlay;
    onBack: () => void;
    onForecastClick: () => void;
    onCloseOverlay: () => void;
}) => (
    <div className="relative flex-1 overflow-hidden" style={{ background: "#e8dcc8" }}>
        <MapSvg
            showRoute={overlay !== "heatmap"}
            highlightForecast={overlay === "forecast"}
            showHeatmap={overlay === "heatmap"}
        />

        {/* Clickable forecast camera point */}
        {overlay === "none" && (
            <button
                type="button"
                aria-label="Прогнозируемая точка"
                className="absolute cursor-pointer"
                style={{ left: "43%", top: "38%", transform: "translate(-50%,-50%)" }}
                onClick={onForecastClick}
            >
                <div className="size-5 animate-ping rounded-full bg-brand-solid opacity-40" />
            </button>
        )}

        {/* Back button */}
        <button
            type="button"
            onClick={onBack}
            className="absolute top-4 left-4 z-10 flex size-9 items-center justify-center rounded-full border border-secondary bg-primary shadow-md transition duration-100 ease-linear hover:bg-secondary_hover"
            aria-label="Назад"
        >
            <ArrowLeft className="size-5 text-fg-secondary" />
        </button>

        {/* Zoom controls */}
        <div className={cx("absolute z-10 flex flex-col overflow-hidden rounded-xl border border-secondary bg-primary shadow-md", overlay === "heatmap" ? "right-4 bottom-4" : "right-4 bottom-4")}>
            <button type="button" className="flex size-10 items-center justify-center text-lg font-medium text-fg-secondary transition duration-100 ease-linear hover:bg-secondary_hover">+</button>
            <div className="h-px w-full bg-secondary" />
            <button type="button" className="flex size-10 items-center justify-center text-lg font-medium text-fg-secondary transition duration-100 ease-linear hover:bg-secondary_hover">−</button>
        </div>

        {/* Forecast popup overlay */}
        {overlay === "forecast" && (
            <ForecastPopup onClose={onCloseOverlay} onShowList={onCloseOverlay} />
        )}

        {/* Heatmap overlays */}
        {overlay === "heatmap" && (
            <>
                <HeatmapLegend />
                <HeatmapControlPanel />
            </>
        )}
    </div>
);

// ─── Welcome screen ───────────────────────────────────────────────────────────

const WelcomeScreen = ({ onSelect }: { onSelect: (s: Suggestion) => void }) => (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-10">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-solid shadow-lg">
                <svg viewBox="0 0 32 32" className="size-8 fill-white" aria-hidden="true">
                    <path d="M16 2 L19 12 L29 14 L19 16 L16 26 L13 16 L3 14 L13 12 Z" />
                </svg>
            </div>
            <div className="text-center">
                <h2 className="text-xl font-semibold text-primary">Чем могу помочь?</h2>
                <p className="mt-1 text-sm text-tertiary">Выберите запрос или введите свой вопрос</p>
            </div>
        </div>

        {/* Suggestion chips */}
        <div className="flex w-full max-w-sm flex-col gap-2.5">
            {SUGGESTIONS.map((s) => (
                <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelect(s)}
                    className="flex items-center gap-3 rounded-xl border border-secondary bg-primary px-4 py-3 text-left shadow-xs transition duration-100 ease-linear hover:border-brand hover:bg-brand-primary_alt hover:shadow-sm active:scale-[0.99]"
                >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-base">
                        {s.icon}
                    </span>
                    <span className="text-sm font-medium text-primary">{s.label}</span>
                </button>
            ))}
        </div>
    </div>
);

// ─── Chat input bar ───────────────────────────────────────────────────────────

const ChatInputBar = ({
    isRecording,
    onToggleRecording,
    onPhotoUpload,
}: {
    isRecording: boolean;
    onToggleRecording: () => void;
    onPhotoUpload: () => void;
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className={cx("border-t border-secondary bg-primary px-4 py-3", isRecording && "bg-error-primary")}>
            {/* Recording indicator */}
            {isRecording && (
                <div className="mb-2 flex items-center justify-center gap-2">
                    <span className="size-2 animate-pulse rounded-full bg-error-solid" />
                    <span className="text-xs font-medium text-error-primary">Запись... нажмите ещё раз для остановки</span>
                </div>
            )}

            <div className={cx(
                "flex items-center gap-2 rounded-full border px-4 py-2.5 shadow-sm transition duration-100 ease-linear",
                isRecording
                    ? "border-error bg-primary"
                    : "border-secondary bg-primary focus-within:border-brand focus-within:ring-1 focus-within:ring-brand",
            )}>
                {/* AI avatar dot */}
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-solid">
                    <svg viewBox="0 0 16 16" className="size-3.5 fill-white" aria-hidden="true">
                        <path d="M8 1 L9 6 L14 7 L9 8 L8 13 L7 8 L2 7 L7 6 Z" />
                    </svg>
                </div>

                <input
                    type="text"
                    placeholder={isRecording ? "Говорите..." : "Написать Sergek AI..."}
                    className="min-w-0 flex-1 bg-transparent text-sm text-primary placeholder:text-placeholder outline-none"
                    readOnly={isRecording}
                />

                {/* Photo upload */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex size-8 items-center justify-center rounded-full text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary_hover hover:text-fg-tertiary"
                    aria-label="Загрузить фото"
                >
                    <Image01 className="size-4" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoUpload} />

                {/* Voice */}
                <button
                    type="button"
                    onClick={onToggleRecording}
                    className={cx(
                        "flex size-8 items-center justify-center rounded-full transition duration-100 ease-linear",
                        isRecording
                            ? "bg-error-solid text-white hover:bg-error-solid_hover"
                            : "text-fg-quaternary hover:bg-secondary_hover hover:text-fg-tertiary",
                    )}
                    aria-label={isRecording ? "Остановить запись" : "Голосовой ввод"}
                >
                    <Microphone01 className="size-4" />
                </button>

                {/* Send */}
                <Button size="sm" color="primary" iconLeading={Send01} aria-label="Отправить" />
            </div>
        </div>
    );
};

// ─── Chat panel ───────────────────────────────────────────────────────────────

const ChatPanel = ({
    messages,
    onViewMap,
    onViewHeatmap,
    onSuggestionSelect,
    isRecording,
    onToggleRecording,
    onPhotoUpload,
}: {
    messages: ChatMessage[];
    onViewMap: () => void;
    onViewHeatmap: () => void;
    onSuggestionSelect: (s: Suggestion) => void;
    isRecording: boolean;
    onToggleRecording: () => void;
    onPhotoUpload: () => void;
}) => (
    <div className="flex min-w-0 flex-1 flex-col bg-secondary">
        {messages.length === 0 ? (
            <WelcomeScreen onSelect={onSuggestionSelect} />
        ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
                {messages.map((msg) => {
                    if (msg.role === "ai-text") return <AiTextBubble key={msg.id} msg={msg} />;
                    if (msg.role === "user") return <UserBubble key={msg.id} msg={msg} />;
                    if (msg.role === "ai-reports") return <AiReportsBubble key={msg.id} msg={msg} />;
                    if (msg.role === "ai-video") return <AiVideoBubble key={msg.id} msg={msg} />;
                    if (msg.role === "ai-visual-search") return <AiVisualSearchBubble key={msg.id} msg={msg} onViewMap={onViewMap} />;
                    if (msg.role === "ai-heatmap") return <AiHeatmapBubble key={msg.id} msg={msg} onViewMap={onViewHeatmap} />;
                    return <SearchResultCard key={msg.id} msg={msg} onViewMap={onViewMap} />;
                })}
            </div>
        )}

        <ChatInputBar
            isRecording={isRecording}
            onToggleRecording={onToggleRecording}
            onPhotoUpload={onPhotoUpload}
        />
    </div>
);


// ─── Sidebar ──────────────────────────────────────────────────────────────────

const Sidebar = ({ activeView }: { activeView: View }) => (
    <aside className="flex w-[60px] shrink-0 flex-col items-center gap-1 border-r border-secondary bg-primary py-3">
        <ButtonUtility color="tertiary" size="sm" icon={Edit01} tooltip="Новый чат" />
        <button
            type="button"
            className={cx(
                "flex size-9 items-center justify-center rounded-lg transition duration-100 ease-linear",
                activeView === "chat"
                    ? "bg-secondary text-fg-secondary"
                    : "text-fg-quaternary hover:bg-primary_hover hover:text-fg-quaternary_hover",
            )}
            aria-label="Чат"
        >
            <MessageSquare02 className="size-5" />
        </button>
        <ButtonUtility color="tertiary" size="sm" icon={ClockRewind} tooltip="История" />
    </aside>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

const MIN_CHAT_WIDTH = 260;
const MAX_CHAT_WIDTH = 560;
const DEFAULT_CHAT_WIDTH = 340;

export const AiChatScreen = () => {
    const [view, setView] = useState<View>("chat");
    const [mapOverlay, setMapOverlay] = useState<MapOverlay>("none");
    const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [activeEvents, setActiveEvents] = useState<EventItem[]>(EVENTS);
    const [eventsSubtitle, setEventsSubtitle] = useState("123QWE01 · 170 фиксаций");
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const dragRef = useRef(false);

    const handleViewMap = () => { setView("map"); setMapOverlay("none"); setSelectedEventId(null); };
    const handleViewHeatmap = () => { setView("map"); setMapOverlay("heatmap"); setSelectedEventId(null); };
    const handleBack = () => { setView("chat"); setMapOverlay("none"); setSelectedEventId(null); };

    const handleSuggestionSelect = (s: Suggestion) => {
        const userMsg: UserMsg = { id: "u1", role: "user", time: "только что", text: s.userText };
        setSelectedEventId(null);

        if (s.id === "plate-search") {
            setMessages(PLATE_SEARCH_MESSAGES);
            setActiveEvents(EVENTS);
            setEventsSubtitle("123QWE01 · 170 фиксаций");
        } else if (s.id === "foreign-vehicles") {
            setMessages(FOREIGN_VEHICLES_MESSAGES);
        } else if (s.id === "visual-search") {
            setMessages(VISUAL_SEARCH_MESSAGES);
            setActiveEvents(VISUAL_SEARCH_EVENTS);
            setEventsSubtitle("белый Toyota Camry · 15 ТС");
        } else if (s.id === "heatmap") {
            setMessages(HEATMAP_MESSAGES);
        } else {
            const aiMsg = placeholderResponse("Обрабатываю запрос... Этот сценарий будет реализован в следующей итерации.");
            setMessages([userMsg, { ...aiMsg, id: "r1" }]);
        }
    };

    const selectedEvent = selectedEventId ? activeEvents.find((e) => e.id === selectedEventId) ?? null : null;

    const handlePhotoUpload = () => {
        // Mockup: show a placeholder user message with photo
        const userMsg: UserMsg = { id: `u${Date.now()}`, role: "user", time: "только что", text: "📷 Фото загружено" };
        setMessages((prev) => [...prev, userMsg]);
    };

    const onDragStart = (e: React.MouseEvent) => {
        e.preventDefault();
        dragRef.current = true;
        const startX = e.clientX;
        const startWidth = chatWidth;

        const onMove = (ev: MouseEvent) => {
            if (!dragRef.current) return;
            setChatWidth(Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, startWidth + (ev.clientX - startX))));
        };
        const onUp = () => {
            dragRef.current = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    return (
        <div className="flex h-dvh overflow-hidden bg-primary">
            <Sidebar activeView={view} />

            {/* Chat panel */}
            <div
                className="flex min-h-0 shrink-0 flex-col"
                style={{ width: view === "map" ? chatWidth : undefined, flex: view === "chat" ? 1 : undefined }}
            >
                <ChatPanel
                    messages={messages}
                    onViewMap={handleViewMap}
                    onViewHeatmap={handleViewHeatmap}
                    onSuggestionSelect={handleSuggestionSelect}
                    isRecording={isRecording}
                    onToggleRecording={() => setIsRecording((r) => !r)}
                    onPhotoUpload={handlePhotoUpload}
                />
            </div>

            {view === "map" && (
                <>
                    {/* Resize handle */}
                    <div
                        onMouseDown={onDragStart}
                        className="group relative z-10 flex w-1 shrink-0 cursor-col-resize items-center justify-center bg-secondary transition duration-100 ease-linear hover:bg-brand"
                        title="Изменить ширину панели"
                    >
                        <div className="absolute flex h-10 w-4 items-center justify-center gap-0.5 rounded-full opacity-0 transition duration-100 group-hover:opacity-100">
                            <div className="h-5 w-0.5 rounded-full bg-white" />
                            <div className="h-5 w-0.5 rounded-full bg-white" />
                        </div>
                    </div>

                    {/* Map + events column */}
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        <MapPanel
                            overlay={mapOverlay}
                            onBack={handleBack}
                            onForecastClick={() => setMapOverlay("forecast")}
                            onCloseOverlay={() => setMapOverlay("none")}
                        />
                        {mapOverlay !== "heatmap" && (
                            <EventsPanel
                                events={activeEvents}
                                subtitle={eventsSubtitle}
                                selectedId={selectedEventId}
                                onSelect={(id) => setSelectedEventId((prev) => prev === id ? null : id)}
                            />
                        )}
                    </div>

                    {/* Detail panel */}
                    {selectedEvent && (
                        <EventDetailPanel
                            event={selectedEvent}
                            onClose={() => setSelectedEventId(null)}
                        />
                    )}
                </>
            )}
        </div>
    );
};
