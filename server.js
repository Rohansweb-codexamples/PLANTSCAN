const express = require("express");
const multer = require("multer");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 10000;

const PLANTNET_API_KEY =
  process.env.PLANTNET_API_KEY;

const PLANTNET_PROJECT = "all";


/* ==============================
   BASIC SERVER CONFIG
   ============================== */

app.use(cors());

app.use(express.json());

app.use(express.static(__dirname));


/* ==============================
   FILE UPLOAD
   ============================== */

const upload = multer({

  storage: multer.memoryStorage(),

  limits:{
    fileSize:50 * 1024 * 1024
  },

  fileFilter:(req,file,cb)=>{

    const allowed = [
      "image/jpeg",
      "image/png"
    ];

    if(allowed.includes(file.mimetype)){
      cb(null,true);
    }else{
      cb(
        new Error(
          "Only JPG and PNG images are supported."
        )
      );
    }

  }

});


/* ==============================
   HEALTH CHECK
   ============================== */

app.get("/api/health",(req,res)=>{

  res.json({
    ok:true,
    plantnetKeyConfigured:Boolean(
      PLANTNET_API_KEY
    )
  });

});


/* ==============================
   PLANT IDENTIFICATION
   ============================== */

app.post(
  "/api/scan",
  upload.single("image"),
  async(req,res)=>{

    try{

      if(!PLANTNET_API_KEY){

        return res.status(500).json({
          error:
            "PLANTNET_API_KEY is not configured on the server."
        });

      }

      if(!req.file){

        return res.status(400).json({
          error:
            "No image was uploaded."
        });

      }

      const url =
        `https://my-api.plantnet.org/v2/identify/${PLANTNET_PROJECT}` +
        `?api-key=${encodeURIComponent(PLANTNET_API_KEY)}` +
        `&lang=en` +
        `&nb-results=5`;


      /*
       * Node 18+ includes fetch,
       * FormData and Blob.
       */

      const form =
        new FormData();

      const blob =
        new Blob(
          [req.file.buffer],
          {
            type:req.file.mimetype
          }
        );

      form.append(
        "images",
        blob,
        req.file.originalname
      );

      form.append(
        "organs",
        "auto"
      );


      const plantnetResponse =
        await fetch(
          url,
          {
            method:"POST",
            body:form
          }
        );


      const text =
        await plantnetResponse.text();

      let data;

      try{

        data =
          JSON.parse(text);

      }catch{

        data = {
          message:text
        };

      }


      if(!plantnetResponse.ok){

        console.error(
          "Pl@ntNet error:",
          plantnetResponse.status,
          data
        );

        return res
          .status(plantnetResponse.status)
          .json({

            error:
              data.message ||
              data.error ||
              `Pl@ntNet returned HTTP ${plantnetResponse.status}.`

          });

      }


      return res.json(data);

    }catch(error){

      console.error(
        "Server error:",
        error
      );

      return res.status(500).json({

        error:
          error.message ||
          "Unable to identify the plant."

      });

    }

  }
);


/* ==============================
   ERROR HANDLER
   ============================== */

app.use(
  (error,req,res,next)=>{

    console.error(error);

    if(error.code === "LIMIT_FILE_SIZE"){

      return res.status(413).json({
        error:
          "The image is too large. Maximum size is 50 MB."
      });

    }

    return res.status(400).json({
      error:
        error.message ||
        "Upload error."
    });

  }
);


/* ==============================
   START
   ============================== */

app.listen(
  PORT,
  "0.0.0.0",
  ()=>{
    console.log(
      `Plant Scanner server running on port ${PORT}`
    );
  }
);
