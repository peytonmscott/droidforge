export type LogLevel = 'V' | 'D' | 'I' | 'W' | 'E' | 'F' | '?';

export interface LogcatLine {
    raw: string;
    timestamp?: string;
    pid?: number;
    tid?: number;
    level: LogLevel;
    tag?: string;
    message: string;
}

const LOG_LEVELS = ['V', 'D', 'I', 'W', 'E', 'F'] as const;

export function parseLogcatLine(line: string): LogcatLine {
    const threadtimeMatch = line.match(/^(\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+([^:]+):\s*(.*)$/);
    if (threadtimeMatch) {
        return {
            raw: line,
            timestamp: threadtimeMatch[1],
            pid: parseInt(threadtimeMatch[2], 10),
            tid: parseInt(threadtimeMatch[3], 10),
            level: threadtimeMatch[4] as LogLevel,
            tag: threadtimeMatch[5].trim(),
            message: threadtimeMatch[6],
        };
    }

    const briefMatch = line.match(/^([VDIWEF])\/([^\(]+)\((\d+)\):\s*(.*)$/);
    if (briefMatch) {
        return {
            raw: line,
            pid: parseInt(briefMatch[3], 10),
            level: briefMatch[1] as LogLevel,
            tag: briefMatch[2].trim(),
            message: briefMatch[4],
        };
    }

    return {
        raw: line,
        level: '?',
        message: line,
    };
}

export function colorizeLogLevel(level: LogLevel): string {
    const colors: Record<LogLevel, string> = {
        'V': '\x1b[90m',
        'D': '\x1b[36m',
        'I': '\x1b[32m',
        'W': '\x1b[33m',
        'E': '\x1b[31m',
        'F': '\x1b[35m',
        '?': '\x1b[0m',
    };
    return colors[level] ?? '\x1b[0m';
}

export function formatLogcatLine(line: LogcatLine): string {
    const color = colorizeLogLevel(line.level);
    const reset = '\x1b[0m';
    
    if (line.tag) {
        return `${color}${line.level}/${line.tag}${reset}: ${line.message}`;
    }
    return `${color}${line.message}${reset}`;
}
