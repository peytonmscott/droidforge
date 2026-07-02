import type { AdbDevice } from './types';

export function parseDevicesOutput(output: string): AdbDevice[] {
    const lines = output.trim().split('\n').slice(1);
    return lines
        .filter(line => line.trim())
        .map(line => {
            const parts = line.split(/\s+/);
            const serial = parts[0] ?? '';
            const status = parts[1] as AdbDevice['status'];
            
            const device: AdbDevice = {
                serial,
                status,
                type: serial.startsWith('emulator-') ? 'emulator' : 
                      serial.includes('.') ? 'unknown' : 'physical',
            };
            
            for (const part of parts.slice(2)) {
                if (part.startsWith('model:')) device.model = part.slice(6);
                if (part.startsWith('product:')) device.product = part.slice(8);
                if (part.startsWith('device:')) device.codename = part.slice(7);
                if (part.startsWith('usb:')) device.transport = part;
                if (part.startsWith('transport_id:') && !device.transport) device.transport = part;
            }
            
            return device;
        });
}

export function parseGetpropOutput(output: string): Record<string, string> {
    const props: Record<string, string> = {};
    const regex = /\[([^\]]+)\]:\s*\[([^\]]*)\]/g;
    let match;
    while ((match = regex.exec(output)) !== null) {
        if (match[1] !== undefined && match[2] !== undefined) {
            props[match[1]] = match[2];
        }
    }
    return props;
}

export function parseAvdList(output: string): string[] {
    return output.trim().split('\n').filter(line => line.trim());
}
