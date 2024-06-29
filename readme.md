# Renshuu Helper

## Installation from source

Currently, only Chrome is supported. Since the extension is still experimental,
it is not yet published to the Chrome Web Store.

1. Clone this repo
1. Select Extensions -> Manage Extensions
1. Turn on "Developer mode"
1. Select "Load unpacked"
1. Select the src directory of this repo

## Setup your API key

### Easy method

Go to renshuu.org, then right click on the page and select "Install renshuu API
key".

### Alternate method

Open the extension's options page, set the API key, and press Save. You can
find your API key in renshuu's options page -> Experimental -> API key. It
should look like a long hex string.

## Usage

Select text on any web page, right click, and choose the "lookup on renshuu"
option. This will open a side panel with a minimal renshuu dictionary.

If you would like to add a term to a list or schedule, click the "+" in the
dictionary entry. Then select checkboxes to add or remove the term from the
corresponding lists or schedules.

There are also options for setting a "favorite list" and "favorite schedule"
which lets you quickly add a term to the list or schedule. These currently show
up as "L+" and "S+" buttons, respectively.

## Possible future ideas

* Support other languages other than English
* Support other browsers other than Chrome
* Make the options page prettier
* Make the "Install renshuu API key" feature less janky
* More renshuu APIs to make this a better extension
* Improvements to renshuu's APIs
* Icons. More Kaochan?
* Search history
* Finish kanji, grammar and sentence searches
* Make the profile page prettier
* Clickable kanji - more locations
