/**
 * Search and filter controls for mod lists.
 */
import { store } from '../state/store';

export class SearchController {
    private searchInactiveInput: HTMLInputElement;
    private searchActiveInput: HTMLInputElement;

    constructor(inactiveId: string, activeId: string) {
        this.searchInactiveInput = document.getElementById(inactiveId) as HTMLInputElement;
        this.searchActiveInput = document.getElementById(activeId) as HTMLInputElement;

        this.bindEvents();
    }

    private bindEvents(): void {
        if (this.searchInactiveInput) {
            this.searchInactiveInput.addEventListener('input', () => {
                store.setSearchInactive(this.searchInactiveInput.value);
            });
        }

        if (this.searchActiveInput) {
            this.searchActiveInput.addEventListener('input', () => {
                store.setSearchActive(this.searchActiveInput.value);
            });
        }
    }

    public clear(): void {
        if (this.searchInactiveInput) {
            this.searchInactiveInput.value = '';
            store.setSearchInactive('');
        }
        if (this.searchActiveInput) {
            this.searchActiveInput.value = '';
            store.setSearchActive('');
        }
    }
}
