const axios=require("axios");


module.exports=async(req,res)=>{


try{


const url=
`https://image.tmdb.org/t/p/${req.query.path}`;


const response=
await axios.get(url,{
responseType:"arraybuffer"
});


res.setHeader(
"Content-Type",
response.headers["content-type"]
);


res.send(response.data);


}catch(e){

res.status(500).send(
"image proxy error"
);

}

};
