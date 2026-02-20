export type DeviceStatus = 'device' | 'offline' | 'unauthorized' | 'bootloader' | 'recovery';

export type DeviceType = 'emulator' | 'physical' | 'unknown';

export interface AdbDevice {
    serial: string;
    status: DeviceStatus;
    type: DeviceType;
    model?: string;
    product?: string;
    codename?: string;
    transport?: string;
}

export interface DeviceMetadata {
    manufacturer: string;
    model: string;
    brand: string;
    device: string;
    androidVersion: string;
    apiLevel: number;
    density: number;
    isEmulator: boolean;
}

export interface AvdInfo {
    name: string;
    isRunning: boolean;
    serial?: string;
}

export interface AdbCommandResult {
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
}
