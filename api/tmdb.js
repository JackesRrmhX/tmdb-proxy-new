const axios = require("axios");

module.exports = async (req, res) => {

  const path = req.query.path;

  if (!path) {
    return res.status(400).json({
      error:"missing path"
    });
  }


  try {

    const response = await axios.get(
      `https://api.themoviedb.org/3/${path}`,
      {
        headers:{
          Authorization:
          `Bearer ${process.env.TMDB_TOKEN}`
        },
        params:req.query
      }
    );


    res.json(response.data);


  } catch(e){

    console.log(e.response?.data);

    res.status(
      e.response?.status || 500
    ).json({
      error:e.message
    });

  }

};
