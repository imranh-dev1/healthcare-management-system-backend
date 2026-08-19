import config from "../config"

export const getBikashGrantIdToken = async ()=> {
    const response = await fetch(`${config.bikash_sendbox_url}/tokenized/checkout/token/grant`, {

        method: "POST",
        headers:{
            "content-type": "application/json",
            Accept: "application/json",
            username: config.bikash_username,
            password: config.bikash_passwprd,
        },
        body: JSON.stringify({
            app_key: config.bikash_app_key,
            app_secret: config.bikash_app_secret
        })
    });

    const result = await response.json();
    return result
        
}