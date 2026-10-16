import { apiGet } from '@/lib/api/client';
import {
  courseDetailSchema,
  courseSummarySchema,
  greenCentersSchema,
} from '@/lib/validation/schemas';
import type { CourseDetail, CourseSummary } from '@/types/domain';
import { z } from 'zod';

const listSchema = z.object({
  data: z.array(courseSummarySchema),
  meta: z.object({ page: z.number(), perPage: z.number(), total: z.number() }),
});

export async function searchCourses(query: string, page = 1): Promise<CourseSummary[]> {
  const res = await apiGet<unknown>(`/v1/courses/search?q=${encodeURIComponent(query)}&page=${page}`);
  const parsed = listSchema.safeParse(res);
  if (!parsed.success) throw new Error('Unexpected course API response');
  return parsed.data.data;
}

export async function nearbyCourses(
  latitude: number,
  longitude: number,
  radiusKm = 25,
): Promise<CourseSummary[]> {
  const res = await apiGet<unknown>(
    `/v1/courses/nearby?lat=${latitude}&lng=${longitude}&radius=${radiusKm}`,
  );
  const parsed = listSchema.safeParse(res);
  if (!parsed.success) throw new Error('Unexpected course API response');
  return parsed.data.data;
}

export async function getCourse(providerId: string): Promise<CourseDetail> {
  const res = await apiGet<unknown>(`/v1/courses/${encodeURIComponent(providerId)}`);
  const parsed = courseDetailSchema.safeParse(res);
  if (!parsed.success) throw new Error('Unexpected course detail response');
  return parsed.data;
}

export interface GreenCenters {
  available: boolean;
  holes: { hole: number; latitude: number; longitude: number }[];
}

export async function getGreenCenters(providerId: string): Promise<GreenCenters> {
  const res = await apiGet<unknown>(`/v1/courses/${encodeURIComponent(providerId)}/green-centers`);
  const parsed = greenCentersSchema.safeParse(res);
  if (!parsed.success) return { available: false, holes: [] };
  return parsed.data;
}
