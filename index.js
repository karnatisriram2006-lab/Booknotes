import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import { db } from "./firebase.js"; // Import Firestore database
import { collection, getDocs, addDoc, deleteDoc, doc, query, where } from "firebase/firestore"; 
import dotenv from "dotenv";

dotenv.config();
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.get("/test", (req, res) => {
    res.send("Test route is working!");
});

// Open Library API book fetching function (no changes needed here)
async function fetchBook(title) {
  try {
    const searchRes = await axios.get("https://openlibrary.org/search.json", {
      params: { q: title, limit: 1 }
    });
    const book = searchRes.data.docs[0];
    if (!book) return null;

    const author = book.author_name ? book.author_name[0] : "Unknown";
    const coverId = book.cover_i;
    const coverPageUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : "/images/placeholder.png";

    return {
      title: book.title,
      author: author,
      coverPageUrl: coverPageUrl,
    };
  } catch (error) {
    console.error("Error fetching book:", error.message);
    return null;
  }
}

// Routes using Firestore
app.get("/", async (req, res) => {
    try {
        const booksCol = collection(db, "books");
        const bookSnapshot = await getDocs(booksCol);
        const books = bookSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const message = req.query.message || null;
        res.render("index.ejs", { books: books, message: message });
    } catch (err) {
        console.error("Firestore get error:", err);
        res.render("index.ejs", { books: [], message: "Failed to load books." });
    }
});

app.post("/addBook", async (req, res) => {
    const { title, rating } = req.body;
    if (!title || !rating) {
        return res.redirect('/?message=' + encodeURIComponent('Title and rating are required.'));
    }

    const bookData = await fetchBook(title);
    if (!bookData) {
        return res.redirect('/?message=' + encodeURIComponent('Book not found on Open Library.'));
    }

    try {
        // Check for duplicates
        const q = query(collection(db, "books"), where("title", "==", bookData.title), where("author", "==", bookData.author));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            return res.redirect('/?message=' + encodeURIComponent('This book already exists in your collection.'));
        }

        // Add book to Firestore
        await addDoc(collection(db, "books"), {
            ...bookData,
            rating: parseInt(rating),
            createdAt: new Date()
        });
        res.redirect("/");
    } catch (err) {
        console.error("Firestore add error:", err);
        res.redirect('/?message=' + encodeURIComponent('Failed to save book.'));
    }
});

app.post("/deleteBook", async (req, res) => {
    const { bookId } = req.body;
    try {
        await deleteDoc(doc(db, "books", bookId));
        res.redirect("/");
    } catch (err) {
        console.error("Firestore delete error:", err);
        res.redirect('/?message=' + encodeURIComponent('Failed to delete book.'));
    }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
