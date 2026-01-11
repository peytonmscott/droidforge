import { BoxRenderable, Text, TextAttributes } from "@opentui/core";
import { ActionsViewModel } from '../../viewmodels';
import { ansiToStyledText, type AnsiPalette } from "../../utilities";
import type { UiTheme } from "../theme";

function stripAnsi(text: string): string {
    return text
        // CSI
        .replace(/\u001b\[[0-9;?]*[@-~]/g, '')
        // OSC (BEL or ST terminator)
        .replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, '');
}

export function ActionOutputView(
    renderer: any,
    viewModel: ActionsViewModel,
    command: string,
    theme: UiTheme,
    ansiPalette: AnsiPalette,
    setStatusText?: (text: string) => void,
    onBack?: () => void
): BoxRenderable {
    const container = new BoxRenderable(renderer, {
        id: "action-output-container",
        flexDirection: "column",
        flexGrow: 1,
        backgroundColor: theme.backgroundColor ?? "transparent",
    });

    const executionHeader = Text({
        id: 'execution-header',
        content: `Executing: ${command}`,
        fg: theme.mutedTextColor ?? theme.textColor,
        attributes: TextAttributes.DIM,
        margin: 1,
        wrapMode: 'word',
    });

    const outputPanel = new BoxRenderable(renderer, {
        id: "output-panel",
        flexGrow: 1,
        border: true,
        borderStyle: "single",
        borderColor: theme.borderColor ?? "#475569",
        backgroundColor: theme.panelBackgroundColor ?? "transparent",
        margin: 1,
        onSizeChange: function() {
            viewModel.setOutputWindowSize(Math.max(1, this.height - 2));
        },
    });

    let outputText = Text({
        id: "output-text",
        content: "",
        attributes: TextAttributes.NONE,
        fg: theme.textColor,
        flexGrow: 1,
        wrapMode: 'char',
    });
    outputPanel.add(outputText);

    container.add(executionHeader);
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
        const output = viewModel.output;
        const visibleLineCount = getVisibleLineCount();

        if (viewModel.state === 'running') {
            ensureLive();
        } else {
            dropLive();
        }

        viewModel.setOutputWindowSize(visibleLineCount);

        const visibleLines = output.lines.slice(
            output.scrollOffset,
            output.scrollOffset + visibleLineCount,
        );

        outputText = Text({
            id: "output-text",
            content: ansiToStyledText(visibleLines.join('\n'), { palette: ansiPalette }),
            attributes: TextAttributes.NONE,
            fg: theme.textColor,
            flexGrow: 1,
            wrapMode: 'char',
        });
        outputPanel.remove('output-text');
        outputPanel.add(outputText);

        const stateIcons: Record<string, string> = {
            'idle': '⏸',
            'running': '⏳',
            'completed': '✅',
            'error': '❌',
        };
        const stateIcon = stateIcons[viewModel.state];
        const exitInfo = output.exitCode !== null ? ` (exit: ${output.exitCode})` : '';
        const scrollInfo = `[${output.scrollOffset + 1}-${Math.min(output.scrollOffset + visibleLineCount, output.lines.length)}/${output.lines.length}]`;
        setStatusText?.(`${stateIcon} ${viewModel.state}${exitInfo} ${scrollInfo} • j/k: scroll • c: copy • ESC: cancel/back`);
    }

    viewModel.setOutputUpdateCallback(updateOutput);

    const keyHandler = (key: any) => {
        switch (key.name) {
            case 'j':
            case 'down':
                if (viewModel.state !== 'idle') {
                    viewModel.scrollDown();
                }
                break;
            case 'k':
            case 'up':
                if (viewModel.state !== 'idle') {
                    viewModel.scrollUp();
                }
                break;
            case 'c':
                if (viewModel.state === 'completed' || viewModel.state === 'error') {
                    const text = stripAnsi(viewModel.getOutputText());
                    try {
                        Bun.spawn(['pbcopy'], {
                            stdin: new Response(text).body!
                        });
                        setStatusText?.('📋 Copied to clipboard!');
                        setTimeout(updateOutput, 1500);
                    } catch {
                        // Ignore clipboard errors
                    }
                }
                break;
            case 'escape':
                if (viewModel.state === 'running') {
                    viewModel.cancelTask();
                } else if (viewModel.state === 'completed' || viewModel.state === 'error') {
                    viewModel.reset();
                    if (onBack) onBack();
                }
                break;
        }
    };

    renderer.keyInput.on("keypress", keyHandler);

    (container as any).__dispose = () => {
        dropLive();
        if (typeof renderer.keyInput.off === 'function') {
            renderer.keyInput.off("keypress", keyHandler);
        } else if (typeof renderer.keyInput.removeListener === 'function') {
            renderer.keyInput.removeListener("keypress", keyHandler);
        }

        // Prevent updates from touching destroyed nodes.
        viewModel.setOutputUpdateCallback(() => undefined);
    };

    ensureLive();

    setStatusText?.(`⏳ starting • j/k: scroll • c: copy • ESC: cancel/back`);

    viewModel.setOutputWindowSize(getVisibleLineCount());
    viewModel.runGradleCommand(command);

    return container;
}
