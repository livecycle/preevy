#!/bin/bash

# Get the parent folder of the script
parent_folder=$(dirname "$(readlink -f "$0")")

# Specify the folder path relative to the parent folder
folder_path="$parent_folder/../docs"

# Define the relative paths
docs_source_path="../docs"
commands_destination_path="../../../site/docs/cli-reference/commands/"
readme_source_path="../README.md"
index_destination_path="../../../site/docs/cli-reference/index.md"

# Find and replace URLs containing /dist/commands/ with /packages/cli/src/commands/
find "$parent_folder/$docs_source_path" -type f -exec sed -i.bak 's#/dist/commands/#/packages/cli/src/commands/#g' {} +
find "$parent_folder/$docs_source_path" -type f -name "*.bak" -delete

# Move files from docs_source_path to commands_destination_path
cp -R "$parent_folder/$docs_source_path/"* "$parent_folder/$commands_destination_path"

# Copy README.md from readme_source_path to index_destination_path
cp "$parent_folder/$readme_source_path" "$parent_folder/$index_destination_path"


# Find and replace URLs containing /docs with /commands/
sed 's#docs/#commands/#g' "$parent_folder/$index_destination_path" > "$parent_folder/$index_destination_path.tmp"
mv "$parent_folder/$index_destination_path.tmp" "$parent_folder/$index_destination_path"