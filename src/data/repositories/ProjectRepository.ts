import { Database } from './Database';
import type { Project } from '../schemas';

export class ProjectRepository {
    constructor(private db: Database) {}

    async getProjectByPath(projectPath: string): Promise<Project | null> {
        return new Promise((resolve, reject) => {
            this.db.getDb().get('SELECT * FROM projects WHERE path = ?', [projectPath], (err, row: any) => {
                if (err) reject(err);
                else if (row) {
                    resolve({
                        id: (row as any).id,
                        name: (row as any).name,
                        path: (row as any).path ?? '',
                        status: (row as any).status,
                        description: (row as any).description,
                        createdAt: new Date((row as any).created_at),
                        updatedAt: new Date((row as any).updated_at)
                    });
                } else {
                    resolve(null);
                }
            });
        });
    }

    async getAllProjects(): Promise<Project[]> {
        return new Promise((resolve, reject) => {
            this.db.getDb().all('SELECT * FROM projects ORDER BY updated_at DESC', (err, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows
                    .map((row: any) => ({
                        id: row.id,
                        name: row.name,
                        path: row.path ?? '',
                        status: row.status,
                        description: row.description,
                        createdAt: new Date(row.created_at),
                        updatedAt: new Date(row.updated_at)
                    }))
                    .filter((project: Project) => project.path.length > 0)
                );
            });
        });
    }

    async getProjectById(id: string): Promise<Project | null> {
        return new Promise((resolve, reject) => {
            this.db.getDb().get('SELECT * FROM projects WHERE id = ?', [id], (err, row: any) => {
                if (err) reject(err);
                else if (row) {
                    resolve({
                        id: (row as any).id,
                        name: (row as any).name,
                        path: (row as any).path ?? '',
                        status: (row as any).status,
                        description: (row as any).description,
                        createdAt: new Date((row as any).created_at),
                        updatedAt: new Date((row as any).updated_at)
                    });
                } else {
                    resolve(null);
                }
            });
        });
    }

    async saveProject(project: Project): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO projects (id, name, path, status, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                project.id,
                project.name,
                project.path,
                project.status,
                project.description || null,
                project.createdAt.toISOString(),
                project.updatedAt.toISOString()
            ];

            this.db.getDb().run(sql, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async deleteProject(id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.getDb().run('DELETE FROM projects WHERE id = ?', [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}