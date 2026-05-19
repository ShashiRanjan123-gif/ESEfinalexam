// ======================================================
// AI SMART COMPLAINT MANAGEMENT SYSTEM
// COMPLETE MERN BACKEND - INDEX.JS
// ======================================================

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);

// ======================================================
// ENV VARIABLES
// ======================================================

const PORT = process.env.PORT || 5000;

const JWT_SECRET =
  process.env.JWT_SECRET || "supersecretjwtkey";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

// ======================================================
// MONGODB CONNECTION
// ======================================================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected Successfully");
  })
  .catch((error) => {
    console.log("MongoDB Error:", error.message);
  });

// ======================================================
// USER SCHEMA
// ======================================================

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

// ======================================================
// COMPLAINT SCHEMA
// ======================================================

const complaintSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      required: true,
    },

    location: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      default: "Pending",
    },

    priority: {
      type: String,
      default: "Medium",
    },

    department: {
      type: String,
      default: "General Department",
    },

    summary: {
      type: String,
      default: "",
    },

    aiResponse: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Complaint = mongoose.model(
  "Complaint",
  complaintSchema
);

// ======================================================
// GENERATE JWT TOKEN
// ======================================================

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: "7d",
  });
};

// ======================================================
// AUTH MIDDLEWARE
// ======================================================

const authMiddleware = async (
  req,
  res,
  next
) => {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Access Denied. No Token.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid Token Format",
      });
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Unauthorized Access",
    });
  }
};

// ======================================================
// AI ANALYZER FUNCTION
// ======================================================

const analyzeComplaintAI = async (
  complaintText
) => {
  try {
    const model =
      genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
      });

    const prompt = `
You are an AI Complaint Analyzer.

Analyze the complaint and return ONLY VALID JSON.

Complaint:
${complaintText}

JSON Format:
{
  "priority":"High/Medium/Low",
  "department":"Department Name",
  "summary":"Short Summary",
  "response":"Professional response for user"
}
`;

    const result =
      await model.generateContent(prompt);

    const response =
      await result.response;

    const text = response.text();

    // SAFE JSON EXTRACTION
    const jsonMatch =
      text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error(
        "Invalid AI JSON Response"
      );
    }

    const parsedData = JSON.parse(
      jsonMatch[0]
    );

    return parsedData;
  } catch (error) {
    console.log(
      "AI ERROR:",
      error.message
    );

    // FALLBACK RESPONSE
    return {
      priority: "Medium",
      department:
        "General Department",
      summary:
        "Complaint received successfully.",
      response:
        "Thank you for your complaint. Our team will review it shortly.",
    };
  }
};

// ======================================================
// HOME ROUTE
// ======================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "AI Smart Complaint Management Backend Running",
  });
});

// ======================================================
// REGISTER USER
// ======================================================

app.post(
  "/api/auth/register",
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
      } = req.body;

      // VALIDATION

      if (
        !name ||
        !email ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message:
            "All fields are required",
        });
      }

      // CHECK USER

      const existingUser =
        await User.findOne({
          email,
        });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message:
            "User already exists",
        });
      }

      // HASH PASSWORD

      const hashedPassword =
        await bcrypt.hash(password, 10);

      // CREATE USER

      const user = await User.create({
        name,
        email,
        password: hashedPassword,
      });

      res.status(201).json({
        success: true,
        message:
          "User Registered Successfully",
        token: generateToken(
          user._id
        ),
        user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ======================================================
// LOGIN USER
// ======================================================

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const { email, password } =
        req.body;

      // CHECK EMAIL

      const user =
        await User.findOne({
          email,
        });

      if (!user) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid Email",
        });
      }

      // CHECK PASSWORD

      const isMatch =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid Password",
        });
      }

      // RESPONSE

      res.json({
        success: true,
        message:
          "Login Successful",
        token: generateToken(
          user._id
        ),
        user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ======================================================
// ADD COMPLAINT
// ======================================================

app.post(
  "/api/complaints",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        name,
        email,
        title,
        description,
        category,
        location,
      } = req.body;

      // VALIDATION

      if (
        !name ||
        !email ||
        !title ||
        !description ||
        !category ||
        !location
      ) {
        return res.status(400).json({
          success: false,
          message:
            "All complaint fields required",
        });
      }

      // EMAIL VALIDATION

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Email Format",
        });
      }

      // AI ANALYSIS

      const aiData =
        await analyzeComplaintAI(
          description
        );

      // SAVE COMPLAINT

      const complaint =
        await Complaint.create({
          name,
          email,
          title,
          description,
          category,
          location,

          priority:
            aiData.priority,

          department:
            aiData.department,

          summary:
            aiData.summary,

          aiResponse:
            aiData.response,
        });

      res.status(201).json({
        success: true,
        message:
          "Complaint Added Successfully",
        complaint,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ======================================================
// GET ALL COMPLAINTS
// ======================================================

app.get(
  "/api/complaints",
  authMiddleware,
  async (req, res) => {
    try {
      const complaints =
        await Complaint.find().sort({
          createdAt: -1,
        });

      res.json({
        success: true,
        total: complaints.length,
        complaints,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ======================================================
// GET SINGLE COMPLAINT
// ======================================================

app.get(
  "/api/complaints/:id",
  async (req, res) => {
    try {
      const complaint =
        await Complaint.findById(
          req.params.id
        );

      if (!complaint) {
        return res.status(404).json({
          success: false,
          message:
            "Complaint Not Found",
        });
      }

      res.json({
        success: true,
        complaint,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ======================================================
// SEARCH COMPLAINTS BY LOCATION
// ======================================================

app.get(
  "/api/complaints/search/location",
  async (req, res) => {
    try {
      const { location } =
        req.query;

      const complaints =
        await Complaint.find({
          location: {
            $regex: location,
            $options: "i",
          },
        });

      res.json({
        success: true,
        results:
          complaints.length,
        complaints,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ======================================================
// FILTER BY CATEGORY
// ======================================================

app.get(
  "/api/complaints/category/:category",
  async (req, res) => {
    try {
      const complaints =
        await Complaint.find({
          category:
            req.params.category,
        });

      res.json({
        success: true,
        complaints,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ======================================================
// UPDATE COMPLAINT STATUS
// ======================================================

app.put(
  "/api/complaints/:id",
  async (req, res) => {
    try {
      const { status } = req.body;

      const complaint =
        await Complaint.findByIdAndUpdate(
          req.params.id,
          {
            status,
          },
          {
            new: true,
          }
        );

      if (!complaint) {
        return res.status(404).json({
          success: false,
          message:
            "Complaint Not Found",
        });
      }

      res.json({
        success: true,
        message:
          "Complaint Status Updated",
        complaint,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ======================================================
// DELETE COMPLAINT
// ======================================================

app.delete(
  "/api/complaints/:id",
  async (req, res) => {
    try {
      const complaint =
        await Complaint.findByIdAndDelete(
          req.params.id
        );

      if (!complaint) {
        return res.status(404).json({
          success: false,
          message:
            "Complaint Not Found",
        });
      }

      res.json({
        success: true,
        message:
          "Complaint Deleted Successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ======================================================
// AI ANALYSIS API
// ======================================================

app.post(
  "/api/ai/analyze",
  async (req, res) => {
    try {
      const { description } =
        req.body;

      if (!description) {
        return res.status(400).json({
          success: false,
          message:
            "Description Required",
        });
      }

      const aiResult =
        await analyzeComplaintAI(
          description
        );

      res.json({
        success: true,
        aiResult,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ======================================================
// TEST ROUTE
// ======================================================

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message:
      "Backend Working Perfectly",
  });
});

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {
  console.log(err.stack);

  res.status(500).json({
    success: false,
    message:
      "Something went wrong",
  });
});

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {
  console.log(
    `Server Running On Port ${PORT}`
  );
});