import type { Client } from "pg";
import type { CourseStore } from "./upsert-course.ts";
import type { NormalizedCourse } from "../courses/schema.ts";

// Implementación de CourseStore contra Postgres directo (no PostgREST) —
// usada por los jobs de ingesta, que corren server-side y nunca desde el
// cliente/frontend (ver .claude/rules/seguridad.md).
export function createPostgresCourseStore(client: Client): CourseStore {
  return {
    async findBySourceAndSourceId(source, sourceId) {
      const { rows } = await client.query(
        `select id, price_amount, price_currency from courses where source = $1 and source_id = $2`,
        [source, sourceId]
      );
      if (rows.length === 0) return null;
      return {
        id: rows[0].id,
        priceAmount: rows[0].price_amount === null ? null : Number(rows[0].price_amount),
        priceCurrency: rows[0].price_currency,
      };
    },

    async insertCourse(course: NormalizedCourse) {
      const { rows } = await client.query(
        `insert into courses
          (source, source_id, title, description, price_amount, price_currency, rating, level, language, instructor, affiliate_url, image_url, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
         returning id`,
        [
          course.source,
          course.sourceId,
          course.title,
          course.description,
          course.priceAmount,
          course.priceCurrency,
          course.rating,
          course.level,
          course.language,
          course.instructor,
          course.affiliateUrl,
          course.imageUrl,
        ]
      );
      return { id: rows[0].id };
    },

    async updateCourse(id, course: NormalizedCourse) {
      await client.query(
        `update courses set
          title = $2, description = $3, price_amount = $4, price_currency = $5,
          rating = $6, level = $7, language = $8, instructor = $9,
          affiliate_url = $10, image_url = $11, updated_at = now()
         where id = $1`,
        [
          id,
          course.title,
          course.description,
          course.priceAmount,
          course.priceCurrency,
          course.rating,
          course.level,
          course.language,
          course.instructor,
          course.affiliateUrl,
          course.imageUrl,
        ]
      );
    },

    async insertPriceHistory(courseId, priceAmount, priceCurrency) {
      await client.query(
        `insert into course_price_history (course_id, price_amount, price_currency, captured_at)
         values ($1, $2, $3, now())`,
        [courseId, priceAmount, priceCurrency]
      );
    },
  };
}
