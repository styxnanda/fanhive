import { db } from "../index.js";
import jwt from "jsonwebtoken";

export const getStories = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(400).json("Not logged in!");

  jwt.verify(token, "secret", (err, userInfo) => {
    if (err) return res.status(403).json("Access token invalid!");
  });

  const q = `SELECT s.storyID as "id", s.story_cover as "coverImage", s.title as "title",
    STRING_AGG(DISTINCT f.fandom_name, ', ') as "fandom", u.username as "author",
    CASE WHEN s.is_finished THEN 'Completed' ELSE 'Ongoing' END as "status",
    ARRAY_AGG(DISTINCT t.tag_name) as "tags", s.story_desc as "synopsis",
    COUNT(DISTINCT c.chapterID) as "chapterCount", s.date_posted as "datePublished",
    MAX(c.date_posted) as "dateUpdated", SUM(LENGTH(REGEXP_REPLACE(c.chapter_content, '\s+', ' ', 'g')) - LENGTH(REPLACE(REGEXP_REPLACE(c.chapter_content, '\s+', ' ', 'g'), ' ', '')) + 1) as "wordCount"
    FROM Stories s 
    LEFT JOIN  Users u ON s.authorID = u.userID
    LEFT JOIN Chapters c ON s.storyID = c.storyID
    LEFT JOIN Story_Fandoms sf ON s.storyID = sf.storyID
    LEFT JOIN Fandoms f ON sf.fandomID = f.fandomID
    LEFT JOIN Story_Tags st ON s.storyID = st.storyID
    LEFT JOIN Tags t ON st.tagID = t.tagID
    GROUP BY s.storyID, u.username;`;

  db.query(q, (err, data) => {
    if (err) return res.status(500).json({ message: err.message });
    return res.status(200).json(data.rows);
  });
};

export const getStory = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(400).json("Not logged in!");

  jwt.verify(token, "secret", (err, userInfo) => {
    if (err) return res.status(403).json("Access token invalid!");
  });

  const q = `SELECT 
    Stories.storyID AS id, 
    Stories.story_cover AS coverImage, 
    Stories.title, 
    Users.username AS author,
    Stories.is_finished AS status,
    Stories.story_desc AS synopsis,
    Stories.date_posted AS datePublished,
    (
      SELECT MAX(Chapters.date_posted)
      FROM Chapters 
      WHERE Chapters.storyID = Stories.storyID
    ) AS dateUpdated,
    ARRAY_AGG(DISTINCT Tags.tag_name) AS tags,
    ARRAY_AGG(DISTINCT Fandoms.fandom_name) AS fandom,
    (SELECT COUNT(*) FROM Chapters WHERE storyID = Stories.storyID) AS chapterCount
    FROM Stories
    INNER JOIN Users ON Stories.authorID = Users.userID
    LEFT JOIN Story_Tags ON Stories.storyID = Story_Tags.storyID
    LEFT JOIN Tags ON Story_Tags.tagID = Tags.tagID
    LEFT JOIN Story_Fandoms ON Stories.storyID = Story_Fandoms.storyID
    LEFT JOIN Fandoms ON Story_Fandoms.fandomID = Fandoms.fandomID
    WHERE Stories.storyID = $1
    GROUP BY Stories.storyID, Users.username;`;

  const chapterQ = `SELECT chapterID AS id, chapter_number AS number, chapter_title AS title, chapter_content AS content
    FROM Chapters
    WHERE storyID = $1;`;

  db.query(q, [req.params.id], (err, data) => {
    if (err) return res.json(err);

    db.query(chapterQ, [req.params.id], (err, chapterData) => {
      if (err) return res.json(err);

      data.rows[0].chapters = chapterData.rows;
      // counting words for all chapters
      const wordCount = chapterData.rows.reduce((acc, curr) => {
        return acc + curr.content.split(" ").length;
      }, 0);

      data.rows[0].wordCount = wordCount;

      return res.status(200).json(data.rows[0]);
    });
  });
};

export const getFollowedStories = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(400).json("Not logged in!");

  jwt.verify(token, "secret", (err, userInfo) => {
    if (err) return res.status(403).json("Access token invalid!");
  });

  const q = `SELECT s.storyID as "id", s.story_cover as "coverImage", s.title as "title",
    STRING_AGG(DISTINCT f.fandom_name, ', ') as "fandom", u.username as "author",
    CASE WHEN s.is_finished THEN 'Completed' ELSE 'Ongoing' END as "status",
    ARRAY_AGG(DISTINCT t.tag_name) as "tags", s.story_desc as "synopsis",
    COUNT(DISTINCT c.chapterID) as "chapterCount", s.date_posted as "datePublished",
    MAX(c.date_posted) as "dateUpdated", 
    SUM(LENGTH(REGEXP_REPLACE(c.chapter_content, '\s+', ' ', 'g')) - LENGTH(REPLACE(REGEXP_REPLACE(c.chapter_content, '\s+', ' ', 'g'), ' ', '')) + 1) as "wordCount"
    FROM Stories s 
    LEFT JOIN Users u ON s.authorID = u.userID
    LEFT JOIN Chapters c ON s.storyID = c.storyID
    LEFT JOIN Story_Fandoms sf ON s.storyID = sf.storyID
    LEFT JOIN Fandoms f ON sf.fandomID = f.fandomID
    LEFT JOIN Story_Tags st ON s.storyID = st.storyID
    LEFT JOIN Tags t ON st.tagID = t.tagID
    WHERE s.authorID IN (SELECT followedID FROM Followers WHERE followerID = $1)
    GROUP BY s.storyID, u.username;`;

  db.query(q, [req.params.id], (err, data) => {
    if (err) return res.status(500).json({ message: err.message });
    return res.status(200).json(data.rows);
  });
};

export const getHeartedStories = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(400).json("Not logged in!");

  jwt.verify(token, "secret", (err, userInfo) => {
    if (err) return res.status(403).json("Access token invalid!");
  });

  const q = `SELECT 
    s.storyID as "id", 
    s.story_cover as "coverImage", 
    s.title as "title",
    STRING_AGG(DISTINCT f.fandom_name, ', ') as "fandom", 
    u.username as "author",
    CASE WHEN s.is_finished THEN 'Completed' ELSE 'Ongoing' END as "status",
    ARRAY_AGG(DISTINCT t.tag_name) as "tags", 
    s.story_desc as "synopsis",
    COUNT(DISTINCT c.chapterID) as "chapterCount", 
    s.date_posted as "datePublished",
    MAX(c.date_posted) as "dateUpdated", 
    SUM(LENGTH(REGEXP_REPLACE(c.chapter_content, '\s+', ' ', 'g')) - LENGTH(REPLACE(REGEXP_REPLACE(c.chapter_content, '\s+', ' ', 'g'), ' ', '')) + 1) as "wordCount"
    FROM Stories s 
    LEFT JOIN Users u ON s.authorID = u.userID
    LEFT JOIN Chapters c ON s.storyID = c.storyID
    LEFT JOIN Story_Fandoms sf ON s.storyID = sf.storyID
    LEFT JOIN Fandoms f ON sf.fandomID = f.fandomID
    LEFT JOIN Story_Tags st ON s.storyID = st.storyID
    LEFT JOIN Tags t ON st.tagID = t.tagID
    INNER JOIN Heart h ON s.storyID = h.storyID
    WHERE h.userID = $1
    GROUP BY s.storyID, u.username;`;

  db.query(q, [req.params.id], (err, data) => {
    if (err) return res.status(500).json({ message: err.message });
    return res.status(200).json(data.rows);
  });
};

export const addStory = (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(400).json("Not logged in!");

  jwt.verify(token, "secret", (err, userInfo) => {
    if (err) return res.status(403).json("Access token invalid!");

    let { title, story_desc, is_finished, fandom, tags, story_cover } =
      req.body;

    if (!story_cover) {
      story_cover = "DefaultNoCover.png";
    }

    const qStory = `INSERT INTO Stories (title, authorID, story_desc, story_cover, is_finished) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING storyID;`;

    db.query(
      qStory,
      [title, userInfo.id, story_desc, story_cover, is_finished],
      (err, result) => {
        if (err) {
          console.log(err.stack);
          return res.status(500).json({ message: err.stack });
        } else {
          const storyID = result.rows[0].storyid;
          const tagsList = tags.split(",");
          const fandomsList = fandom.split(",");

          const insertTags = async () => {
            for (let tag of tagsList) {
              const qTag = `INSERT INTO tags (tag_name) VALUES ($1) ON CONFLICT (tag_name) DO NOTHING RETURNING tagid;`;
              let resultTag = await db.query(qTag, [tag.trim()]);
              const tagID = resultTag.rows[0].tagid;

              const qStoryTag = `INSERT INTO story_tags (storyid, tagid) VALUES ($1, $2);`;
              await db.query(qStoryTag, [storyID, tagID]);
            }
          };

          const insertFandoms = async () => {
            for (let fandom of fandomsList) {
              const qFandom = `INSERT INTO fandoms (fandom_name) VALUES ($1) ON CONFLICT (fandom_name) DO NOTHING RETURNING fandomid;`;
              let resultFandom = await db.query(qFandom, [fandom.trim()]);
              const fandomID = resultFandom.rows[0].fandomid;

              const qStoryFandom = `INSERT INTO story_fandoms (storyid, fandomid) VALUES ($1, $2);`;
              await db.query(qStoryFandom, [storyID, fandomID]);
            }
          };

          Promise.all([insertTags(), insertFandoms()])
            .then(() => res.status(201).json({ message: "Story added!" }))
            .catch((err) => res.status(500).json({ message: err.message }));
        }
      }
    );
  });
};

export const deleteStory = (req, res) => {};

export const updateStory = (req, res) => {};
