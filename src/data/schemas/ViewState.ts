import type { DisposableRenderable, SelectLike } from '../../utilities/rendererTypes';

export interface ViewState {
    currentView: string;
    menuSelect: SelectLike | null;
    currentViewElements: DisposableRenderable[];
}