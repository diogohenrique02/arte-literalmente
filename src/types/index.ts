export type BookFormat = 'epub' | 'pdf' | 'txt';
export type RightsStatus = 'public_domain_verified' | 'open_license' | 'permission_documented' | 'pending_review';
export interface Book {
  id: string; title: string; author: string; description: string | null; cover_path: string | null;
  file_path: string | null; format: BookFormat; genre: string | null; tags: string[] | null;
  publication_year: number | null; language: string | null; publisher: string | null;
  source_url: string | null; rights_status: RightsStatus; published: boolean; allow_download: boolean;
  created_by?: string | null; created_at: string; updated_at: string;
}
export interface ReadingProgress {
  book_id: string; user_id?: string; format: BookFormat; position: number; cfi?: string | null;
  page?: number | null; font_size: number; theme: 'light' | 'dark'; updated_at?: string;
}
export const FORMAT_LABELS: Record<BookFormat, string> = { epub: 'EPUB', pdf: 'PDF', txt: 'TXT' };
export const RIGHTS_LABELS: Record<RightsStatus, string> = {
  public_domain_verified: 'Domínio público verificado',
  open_license: 'Licença aberta compatível',
  permission_documented: 'Autorização documentada',
  pending_review: 'Pendente de revisão',
};