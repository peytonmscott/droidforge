export interface Project {
    id: string;
    name: string;
    path: string;
    status: 'active' | 'completed' | 'draft';
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}
