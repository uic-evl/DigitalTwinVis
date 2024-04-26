We recommend you look at the full code documentation with more images [here](https://docs.google.com/document/d/16mia0hbPDzQpNFhYx1hdBzAa9hGFDriIZEzmrYj0AcA/edit?usp=sharing)
## Digital Twin Code Structure


### Branches



* main has the current interface setup for running locally
* dockerdeploy has a version of main with some endpoints changed to allow for remote deployment
* modeling is the branch I use when testing code in the /python folder.
* Everything else is stuff I forgot to delete


### Top Level



* /data/ houses all the data and files that are ignored by the git repo. This includes patient data, ssl files, and the password hashes we use
* /resources/ houses the files that can be pushed to github, such as saved pytorch models, and pre-made svg paths used to draw the head and neck diagrams in the interfaces
* /python/ includes python code and notebooks for building/training the models, preprocessing the data, and testing api code
* /Backend/ Has the flask app and code for running the backend models. App.py houses the actual flask api code. Most of the stuff outside of App.py is copied from files in the /python/ folder once I get them working
* /frontend houses the react app
* /docker/ houses files used in the docker compose for deploying the system
* docker-compose.yml is the docker compose specification for deploying the system. It's easiest to keep in the top level
* Anything else is probably something I put there before and forgot to delete.


### Frontend



* App.js houses the entrypoint code to serve the login page, and switches to the main app once we're logged in
* Login.js is the login page
* MainApp.js is the actual top level app the defines all the variables, loads the data and returns the overall app structure. This was App.js before I added in a login screen
    * This also has the component that makes the buttons to toggle the model parameters
* /modules/ is non-react stuff	
    * Utils.js: helper functions. I copy over code from earlier projects so some are unnecessary, but this includes the tooltip code, code for cleaning up variable names when showing them on the frontend, some generic color scales for different variables (so they are uniform across components),  and getTreatmentGroups, which does some processing for getting the treated and untreated groups for the neighborhood view, as well as in some other locations. getTreatment groups is a bit of a retrofit of code I ended up having to use elsewhere due to last minute changes
    * Constants.js includes hard coded variables. This includes
        * Names of the decisions
        * Categorical colors used for the treated/untreated DDN prediction and KNN predictions groups, etc
        * Specific variables we show for the user input
    * Dataservice is the api wrapper that makes queries to the backend 
    * Helptext makes the little "?" thing near some of the labels. 
* /components/ is react components
    * About.js: The "about button" modal at the top
    * AttributionLegend: Legend at the bottom of the feature importance waterfall plot
    * AttributionPlot: the waterfall plot showing feature importance in the auxiliary view
    * AuxillaryViews: the main component that toggles the views below the "recommendation" on the right side of the screen. Also includes a bunch of retrofitted data formatting to make those views work
    * DLTVisD3: Shows the DLT diagram guy used in the neighborhood view when looking at CC or ND states
    * Feedback: the "feedback" button at  the top's modal
    * LNVisD3: Shows the Lymph node diagram shown in the input and similar patient panels
    * ModelLegend: Top of the center column, shows the toggleable model names with colors specified in the Constants.js file
    * NeighborView: Draws the similar patient stuff in the auxillary views
    * NeighborVisD3: This draws the kiviats within the neighbor view
    * OtherOutcomes: draws the tables when you use the toggle for "all outcomes" at the top of the center column showing all the outcome predictions
    * OutcomeContainer: composes the Outcomeplots, OutcomeLegend and OtherOutcomes, along with managing the toggle at the top
    * PatientEditor: draws the nonspatial patient feature input part of the left side column 
    * PatientFeatureEditor: Sub-component of patient editor that draws the buttons for each feature in the row. This was actually weirdly complicated
    * RecommendationPlot: draws the barcharts in the top right showing the predicted treatment
    * ScatterplotD3: draws the scatterplot in the AuxillaryView
    * SubsiteVisD3: draws the subsite diagrams in the patient input and similar patients views
    * SurvivalPlots: Draws the temporal survival plots in the center column
    * Symptoms: Draws the symptom trajectories in the auxillary view
    * SymptomVisD3: Subcomponent of Symptoms, draws each individual plot
    * Tutorial: Controls the "help" modal in the top panel
    * useSVGCanvas: hook used in the D3 components that adds a canvas and tooltip based on the parent container. 


### Models

Model code is in the python folder and uses pytorch



* Models.py saves all the pytorch model code
* DeepSurvivalModels.py has code for training the deep survival models
* Preprocessing.py contains the data that loads the data, and the DTDataset() class that is used to organize the data when training the models
* Utils and Misc are helper functions
* SymptomPrediciton contains code for the KNN symptom prediction and neural net used to learn patient embeddings for the KNN
* TimeseriesOutcomes.ipynb trains the deep survival models, has code for parameter tuning and plotting performance.
* TransitionModels.ipynb trains the deep transition state models and boolean outcome models
* Preprocessing.ipynb provides the code to train the policy model
* SVGParsing has some helper code to convert SVGs used in the frontend to dictionaries with the svg paths to help draw them in d3 more easily
