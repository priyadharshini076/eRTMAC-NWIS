from sqlalchemy import text

def get_nearby_wells(db, well_id, radius_m=5000):

    # Check if PostGIS extension is enabled
    has_postgis = False
    try:
        check_ext = db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'postgis'")).scalar()
        has_postgis = bool(check_ext)
    except Exception:
        has_postgis = False

    if has_postgis:
        query = text("""
            SELECT
                w2.well_id,
                w2.well_name,
                w2.formation,
                w2.latitude,
                w2.longitude,

                ROUND(
                    ST_Distance(
                        w1.geom::geography,
                        w2.geom::geography
                    )::numeric,
                    2
                ) AS distance_m,

                COUNT(e.id) AS historical_events,

                COUNT(
                    CASE
                        WHEN e.severity = 'High'
                        THEN 1
                    END
                ) AS high_severity_events,

                COALESCE(latest.event_type, 'None') AS latest_event

            FROM wells_master w1

            JOIN wells_master w2
                ON w1.well_id <> w2.well_id

            LEFT JOIN drilling_events e
                ON e.well_id = w2.well_id

            LEFT JOIN LATERAL (
                SELECT event_type
                FROM drilling_events de
                WHERE de.well_id = w2.well_id
                ORDER BY de.event_date DESC
                LIMIT 1
            ) latest ON TRUE

            WHERE
                w1.well_id = :well_id

            AND ST_DWithin(
                w1.geom::geography,
                w2.geom::geography,
                :radius
            )

            GROUP BY
                w2.well_id,
                w2.well_name,
                w2.formation,
                w2.latitude,
                w2.longitude,
                w1.geom,
                w2.geom,
                latest.event_type

            ORDER BY distance_m;
        """)
    else:
        # Standard PostgreSQL Haversine spherical distance calculation in meters
        query = text("""
            SELECT
                w2.well_id,
                w2.well_name,
                w2.formation,
                w2.latitude,
                w2.longitude,

                ROUND(
                    (6371000.0 * 2.0 * ASIN(
                        SQRT(
                            POWER(SIN(RADIANS(w2.latitude - w1.latitude) / 2.0), 2) +
                            COS(RADIANS(w1.latitude)) * COS(RADIANS(w2.latitude)) *
                            POWER(SIN(RADIANS(w2.longitude - w1.longitude) / 2.0), 2)
                        )
                    ))::numeric,
                    2
                ) AS distance_m,

                COUNT(e.id) AS historical_events,

                COUNT(
                    CASE
                        WHEN e.severity = 'High'
                        THEN 1
                    END
                ) AS high_severity_events,

                COALESCE(latest.event_type, 'None') AS latest_event

            FROM wells_master w1

            JOIN wells_master w2
                ON w1.well_id <> w2.well_id

            LEFT JOIN drilling_events e
                ON e.well_id = w2.well_id

            LEFT JOIN LATERAL (
                SELECT event_type
                FROM drilling_events de
                WHERE de.well_id = w2.well_id
                ORDER BY de.event_date DESC
                LIMIT 1
            ) latest ON TRUE

            WHERE
                w1.well_id = :well_id

            AND (
                6371000.0 * 2.0 * ASIN(
                    SQRT(
                        POWER(SIN(RADIANS(w2.latitude - w1.latitude) / 2.0), 2) +
                        COS(RADIANS(w1.latitude)) * COS(RADIANS(w2.latitude)) *
                        POWER(SIN(RADIANS(w2.longitude - w1.longitude) / 2.0), 2)
                    )
                )
            ) <= :radius

            GROUP BY
                w2.well_id,
                w2.well_name,
                w2.formation,
                w2.latitude,
                w2.longitude,
                w1.latitude,
                w1.longitude,
                latest.event_type

            ORDER BY distance_m;
        """)

    result = db.execute(
        query,
        {
            "well_id": well_id,
            "radius": radius_m
        }
    )

    return result.mappings().all()