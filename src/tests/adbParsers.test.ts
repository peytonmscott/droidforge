import { describe, test, expect } from 'bun:test';
import { parseDevicesOutput, parseAvdList } from '../adb/parsers';

describe('parseDevicesOutput', () => {
    test('parses emulator and physical device lines', () => {
        const output = [
            'List of devices attached',
            'emulator-5554          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:1',
            'R58M12ABCDE            device usb:1-1 product:beyond1ltexx model:SM_G973F device:beyond1 transport_id:2',
            '',
        ].join('\n');

        const devices = parseDevicesOutput(output);
        expect(devices).toHaveLength(2);

        expect(devices[0]).toMatchObject({
            serial: 'emulator-5554',
            status: 'device',
            type: 'emulator',
            model: 'sdk_gphone64_arm64',
            codename: 'emu64a',
            transport: 'transport_id:1',
        });

        expect(devices[1]).toMatchObject({
            serial: 'R58M12ABCDE',
            status: 'device',
            type: 'physical',
            model: 'SM_G973F',
            transport: 'usb:1-1',
        });
    });

    test('does not treat model/product tokens as transport', () => {
        const output = [
            'List of devices attached',
            'emulator-5554 device model:Pixel_7 product:sdk device:emu64a',
        ].join('\n');

        const [device] = parseDevicesOutput(output);
        expect(device?.transport).toBeUndefined();
    });
});

describe('parseAvdList', () => {
    test('returns one AVD per line', () => {
        expect(parseAvdList('Pixel_7_API_34\nPixel_Tablet_API_35\n')).toEqual([
            'Pixel_7_API_34',
            'Pixel_Tablet_API_35',
        ]);
    });
});
