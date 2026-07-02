import { BoxRenderable, Text, TextAttributes } from '@opentui/core';
import type { CliRendererLike } from '../../utilities/rendererTypes';
import type { LogcatViewModel, LogcatConfig } from '../../viewmodels/LogcatViewModel';
import type { UiTheme } from '../theme';
import { Header } from '../components';
import { SPACING } from '../constants';
import { formatLogcatLine } from '../../utilities/logcatParser';

export function LogcatView(
    renderer: CliRendererLike,
    viewModel: LogcatViewModel,
    config: LogcatConfig,
    theme: UiTheme,
    setStatusText?: (text: string) => void,
    onBack?: () => void
): BoxRenderable {
    const container = new BoxRenderable(renderer, {
        id: 'logcat-container',
        flexDirection: 'column',
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? 'transparent',
    });

    const title = config.packageName 
        ? `App Logs: ${config.packageName}` 
        : 'Device Logs';
    const header = Header(renderer, title, config.deviceId ?? 'All devices', theme);
    container.add(header);

    const outputPanel = new BoxRenderable(renderer, {
        id: 'logcat-output-panel',
        flexGrow: 1,
        border: true,
        borderStyle: 'single',
        borderColor: theme.borderColor ?? '#475569',
        backgroundColor: theme.panelBackgroundColor ?? 'transparent',
        margin: SPACING.COMFORTABLE,
        padding: SPACING.NORMAL,
        onSizeChange: function() {
            viewModel.setOutputWindowSize(Math.max(1, this.height - 2));
        },
    });

    let outputText = Text({
        id: 'logcat-output-text',
        content: '',
        attributes: TextAttributes.NONE,
        fg: theme.textColor,
        flexGrow: 1,
        wrapMode: 'char',
    });
    outputPanel.add(outputText);

    container.add(outputPanel);

    function getVisibleLineCount(): number {
        return Math.max(1, outputPanel.height - 2);
    }

    let liveRequested = false;
    const ensureLive = () => {
        if (liveRequested) return;
        if (typeof renderer.requestLive === 'function') {
            renderer.requestLive();
        }
        liveRequested = true;
    };
    const dropLive = () => {
        if (!liveRequested) return;
        if (typeof renderer.dropLive === 'function') {
            renderer.dropLive();
        }
        liveRequested = false;
    };

    function updateOutput(): void {
        const state = viewModel.state;

        if (state === 'running') {
            ensureLive();
        } else {
            dropLive();
        }

        viewModel.setOutputWindowSize(getVisibleLineCount());

        const visibleLines = viewModel.getVisibleLines();
        const formatted = visibleLines.map(l => formatLogcatLine(l)).join('\n');

        outputText = Text({
            id: 'logcat-output-text',
            content: formatted,
            attributes: TextAttributes.NONE,
            fg: theme.textColor,
            flexGrow: 1,
            wrapMode: 'char',
        });
        outputPanel.remove('logcat-output-text');
        outputPanel.add(outputText);

        const stateIcons: Record<string, string> = {
            'idle': '⏸',
            'running': '⏳',
            'paused': '⏸',
            'error': '❌',
        };
        const stateIcon = stateIcons[state];
        const output = viewModel.output;
        const scrollInfo = `[${output.scrollOffset + 1}-${Math.min(output.scrollOffset + getVisibleLineCount(), output.lines.length)}/${output.lines.length}]`;
        setStatusText?.(`${stateIcon} ${state} ${scrollInfo} • j/k: scroll • p: pause • c: clear • ESC: back`);
    }

    viewModel.setOutputUpdateCallback(updateOutput);

    const keyHandler = (key: any) => {
        switch (key.name) {
            case 'j':
            case 'down':
                viewModel.scrollDown();
                break;
            case 'k':
            case 'up':
                viewModel.scrollUp();
                break;
            case 'pageup':
                viewModel.pageUp();
                break;
            case 'pagedown':
                viewModel.pageDown();
                break;
            case 'home':
                viewModel.scrollToTop();
                break;
            case 'end':
                viewModel.scrollToBottom();
                break;
            case 'p':
                if (viewModel.state === 'running') {
                    viewModel.pauseStream();
                } else if (viewModel.state === 'paused') {
                    viewModel.resumeStream();
                }
                break;
            case 'c':
                viewModel.clearBuffer();
                break;
            case 'escape':
                viewModel.stopStream();
                dropLive();
                if (onBack) onBack();
                break;
        }
    };

    renderer.keyInput.on('keypress', keyHandler);

    (container as any).__dispose = () => {
        dropLive();
        renderer.keyInput.off('keypress', keyHandler);
        viewModel.stopStream();
        viewModel.setOutputUpdateCallback(() => undefined);
    };

    viewModel.setConfig(config);
    ensureLive();
    void viewModel.startStream();

    return container;
}
