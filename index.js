import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
let books = [];

// Configure DB client from environment variables (see .env.example)
const db = new pg.Client({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "Booknotes",
  password: process.env.DB_PASSWORD || "",
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
});

db.connect().then(() => {
  console.log("Connected to database");
}).catch(err => {
  console.error("Failed to connect to database:", err.message || err);
});
async function fetchBook(title) {
  try {
    // 1) Search for the book
    const searchRes = await axios.get("https://openlibrary.org/search.json", {
      params: { q: title, limit: 1 }
    });

    const book = searchRes.data.docs[0];
    if (!book) {
      console.log("No results found.");
      return null;
    }

    console.log("Search result keys:", Object.keys(book));
    console.log("Book data:", { isbn: book.isbn, edition_key: book.edition_key, key: book.key });

    // 2) Get ISBN or OLID or use first_edition_key or book key
    let isbn = null;
    let olid = null;
    let bibkey = null;

    if (book.isbn && book.isbn.length > 0) {
      isbn = book.isbn[0];
      bibkey = `ISBN:${isbn}`;
    } else if (book.edition_key && book.edition_key.length > 0) {
      olid = book.edition_key[0];
      bibkey = `OLID:${olid}`;
    } else if (book.first_edition_key) {
      // Fallback: use first_edition_key
      olid = book.first_edition_key;
      bibkey = `OLID:${olid}`;
    } else if (book.key) {
      // Last resort: use the work key
      console.log("Using work key as fallback");
      const workKey = book.key.replace("/works/", "");
      return {
        title: book.title,
        author: book.author_name ? book.author_name[0] : "Unknown",
        coverPageUrl: `https://covers.openlibrary.org/b/id/${book.cover_i || 1}-L.jpg`
      };
    } else {
      console.log("No ISBN, OLID, or edition key found.");
      console.log("Available fields:", Object.keys(book));
      return null;
    }

    console.log("Using bibkey:", bibkey);

    // 3) Get full details using bibkey
    const detailsRes = await axios.get("https://openlibrary.org/api/books", {
      params: {
        bibkeys: bibkey,
        format: "json",
        jscmd: "data"
      }
    });

    const details = detailsRes.data[bibkey];
    if (!details) {
      console.log("Could not fetch details for", bibkey);
      return null;
    }

    // 4) Build cover URL
    const coverPageUrl = isbn 
      ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
      : `https://covers.openlibrary.org/b/olid/${olid}-L.jpg`;

    // 5) Return only title, author, and coverPageUrl
    return {
      title: details.title,
      author: details.authors ? details.authors[0].name : "Unknown",
      coverPageUrl: coverPageUrl
    };
  } catch (error) {
    console.error("Error fetching book:", error);
    return null;
  }
}


app.get("/",async(req,res)=>{
    const result=await db.query("SELECT * FROM books");
    books=result.rows;
    const message = req.query.message || null;
    res.render("index.ejs", { books: books, message: message });
})

app.post("/addBook", async(req,res)=>{
  const newbook=req.body.title;
  const rating = parseInt(req.body.rating) || 5;
  const bookData = await fetchBook(newbook);

  if (bookData) {
    bookData.rating = rating;
    try {
      // Check for duplicates (case-insensitive title + author)
      const exists = await db.query(
        "SELECT id FROM books WHERE LOWER(title) = LOWER($1) AND LOWER(author) = LOWER($2) LIMIT 1",
        [bookData.title, bookData.author]
      );

      if (exists && exists.rowCount > 0) {
        return res.redirect('/?message=' + encodeURIComponent('Book already exists'));
      }

      await db.query(
        "INSERT INTO books (title,author,coverpageurl,rating) VALUES ($1,$2,$3,$4)",
        [bookData.title,bookData.author,bookData.coverPageUrl,bookData.rating]
      );
      console.log("Book added:", bookData);
      return res.redirect("/");
    } catch (err) {
      console.error('DB insert error:', err);
      return res.redirect('/?message=' + encodeURIComponent('Failed to save book'));
    }
  } else {
    // Book not found — redirect back with message
    return res.redirect('/?message=' + encodeURIComponent('Book not found'));
  }
});

app.post("/deleteBook", async(req,res)=>{
  const index = req.body.index;
  await db.query("DELETE FROM books WHERE id=$1",[index]);
  // if (index >= 0 && index < books.length) {
  //   books.splice(index, 1);
  //   console.log("Book deleted at index:", index);
  // }
  res.redirect("/");
})
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
