Crime in Las Vegas
---
__Demo:__ http://ibm.biz/crimeviz

This demo app highlights spatial and temporal analytics. While the crime data is cached in the web app to facilitate offline access, it was initially retrieved from [Cloudant](https://cloudant.com) via a spatial database query.  

After the application loads, you can select crimes on the map using the pencil icon in the top right, and look at the distribution of crime types, and use the slider to focus in on different times of day.

The legend on the left shows:

1. The **total number of crimes** in the outlined area
2. **Crime class:** % of crimes falling into the 3 aggregate categories (same as legend in bottom-right)
3. **Jurisdictional classification:** % of crimes by the city’s categorization scheme
4. **Time of day:** slider to adjust start time and end time, which restricts the display of crimes on the map and updates the stacked bar charts above.


![demo](https://c2.staticflickr.com/6/5671/30569979246_af9a17bd7c_z.jpg)

__Demo:__ http://ibm.biz/crimeviz

### Installing

    npm install

### Running locally

    MapboxAccessToken=<YOUR TOKEN> npm start

Open your browser to http://localhost:9966

### Building

    MapboxAccessToken=<YOUR TOKEN> npm run build

Compiles a minified `bundle.js` for production

### About the data

Crime data gathered from Las Vegas Open Data
https://opendata.lasvegasnevada.gov/Public-Safety/Las-Vegas-Metropolitan-Police-calls-for-service/mapc-ixca
