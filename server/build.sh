#!/bin/bash

# Remove previous dist directory
rm -rf dist/

# Build the code. $@ accepts all the parameters from the input command line and uses it in the maven build command
mvn clean package install "$@" -DskipTests

if [ $? -eq 0 ]
then
  echo "mvn Successful"
else
  echo "mvn Failed"
  exit 1
fi


## Create the dist directory
#mkdir -p dist/plugins
#
## Copy the server jar
#cp -v ./openblocks-server/target/server-*.jar dist/
#
## Copy all the plugins
#rsync -av --exclude "original-*.jar" ./openblocks-plugins/mongoPlugin/target/*.jar dist/plugins/