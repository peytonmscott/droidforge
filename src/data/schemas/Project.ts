export interface Project {
    id: string;
    name: string;
    status: 'active' | 'completed' | 'draft';
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}